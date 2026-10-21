"""Order creation and the single write path for order lines."""

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.errors import ApiError
from app.core.events import bus
from app.features.campaigns.models import OPEN, Campaign
from app.features.campaigns.pricing import suggest_option
from app.features.catalog.models import Product, School
from app.features.orders.models import (
    DRAFT,
    LEGACY_IMPORT,
    SUBMITTED,
    Order,
    OrderKitLine,
    OrderLine,
)

TOPIC = "orders"


class SlotPick(BaseModel):
    slot_id: uuid.UUID
    product_id: uuid.UUID | None = None
    size_label: str | None = Field(default=None, max_length=20)


class KitLineIn(BaseModel):
    kit_id: uuid.UUID
    qty: int = Field(ge=1, le=10)
    size_label: str | None = Field(default=None, max_length=20)
    slots: list[SlotPick] = Field(default_factory=list, max_length=20)


class ItemLineIn(BaseModel):
    product_id: uuid.UUID
    size_label: str = Field(max_length=20)
    qty: int = Field(ge=1, le=20)
    colour: str | None = Field(default=None, max_length=40)


def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(422, "validation_error", "Dữ liệu không hợp lệ", fields)


def _not_found() -> ApiError:
    return ApiError(404, "not_found", "Không tìm thấy đơn hàng")


def _locked() -> ApiError:
    return ApiError(409, "campaign_locked", "Đợt đã khóa, không thể sửa đơn")


def order_info(order: Order) -> dict[str, Any]:
    return {
        "campaign_id": str(order.campaign_id),
        "code": order.code,
        "student_id": str(order.student_id) if order.student_id else None,
        "source": order.source,
        "status": order.status,
        "gender": order.gender,
        "class_label": order.class_label,
        "default_size": order.default_size,
        "note": order.note,
    }


def _lines_snapshot(order: Order) -> dict[str, Any]:
    return {
        "status": order.status,
        "kit_lines": [{"kit_id": str(k.kit_id), "qty": k.qty} for k in order.kit_lines],
        "lines": [
            {
                "product_id": str(line.product_id),
                "size_label": line.size_label,
                "colour": line.colour,
                "qty": line.qty,
                "unit_price": line.unit_price,
                "in_kit": line.kit_line_id is not None,
            }
            for line in order.lines
        ],
    }


async def get_order(session: AsyncSession, order_id: uuid.UUID, lock: bool = False) -> Order:
    query = (
        select(Order)
        .where(Order.id == order_id, Order.deleted_at.is_(None))
        .execution_options(populate_existing=True)
    )
    order = await session.scalar(query.with_for_update() if lock else query)
    if order is None:
        raise _not_found()
    return order


async def _share_lock_campaign(session: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
    campaign = await session.scalar(
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .with_for_update(read=True)
        .execution_options(populate_existing=True)
    )
    assert campaign is not None
    return campaign


async def _next_code(session: AsyncSession, school_code: str) -> str:
    seq = await session.scalar(select(func.nextval("order_code_seq")))
    return f"GB{school_code.upper()}{datetime.now(UTC):%y%m%d}_{seq:05d}"


async def create_order(
    session: AsyncSession,
    campaign: Campaign,
    *,
    recipient_name: str,
    source: str,
    actor: str,
    student_id: uuid.UUID | None = None,
    parent_name: str | None = None,
    parent_phone: str | None = None,
    gender: str | None = None,
    class_label: str | None = None,
    default_size: str | None = None,
    note: str | None = None,
    code: str | None = None,
) -> Order:
    """Add a DRAFT order to the transaction; the caller commits (replace_order_lines does)."""
    if source != LEGACY_IMPORT:
        campaign = await _share_lock_campaign(session, campaign.id)
        if campaign.status != OPEN:
            raise _locked()
    if code is None:
        school = await session.get(School, campaign.school_id)
        assert school is not None
        code = await _next_code(session, school.code)
    order = Order(
        campaign_id=campaign.id,
        code=code,
        student_id=student_id,
        recipient_name=recipient_name,
        parent_name=parent_name,
        parent_phone=parent_phone,
        gender=gender,
        class_label=class_label,
        default_size=default_size,
        source=source,
        status=DRAFT,
        note=note,
        kit_lines=[],
        lines=[],
    )
    session.add(order)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        if "uq_orders_student_per_campaign" not in str(exc.orig):
            raise
        raise ApiError(409, "order_exists", "Học sinh đã có đơn trong đợt này") from None
    await audit.record(session, actor, "order.create", "order", order.id, None, order_info(order))
    return order


async def replace_order_lines(
    session: AsyncSession,
    order: Order,
    kit_lines: list[KitLineIn],
    item_lines: list[ItemLineIn],
    actor: str,
    *,
    submit: bool = False,
    require_open: bool = False,
) -> None:
    """Validate, expand kits into lines, snapshot prices, audit and commit.

    require_open is for parents: they cannot touch an order once the campaign is not OPEN.
    """
    order = await get_order(session, order.id, lock=True)
    campaign = await _share_lock_campaign(session, order.campaign_id)
    if require_open and campaign.status != OPEN:
        raise _locked()
    prices = {i.product_id: i for i in campaign.items}
    kits = {k.id: k for k in campaign.kits}
    wanted = {i.product_id for i in item_lines}
    for kit_line in kit_lines:
        if kit := kits.get(kit_line.kit_id):
            wanted |= {p for s in kit.slots for p in s.product_ids}
    products = {
        p.id: p
        for p in (await session.scalars(select(Product).where(Product.id.in_(wanted)))).all()
    }
    gender_of = {p.id: p.gender_target for p in products.values()}

    fields: dict[str, str] = {}
    planned: list[tuple[int | None, uuid.UUID | None, uuid.UUID, str, str, int]] = []

    def plan(
        key: str, kit_index: int | None, slot_id: uuid.UUID | None, product_id: uuid.UUID,
        size: str | None, colour: str, qty: int,
    ) -> None:  # fmt: skip
        product = products[product_id]
        if not size:
            fields[f"{key}.size_label"] = "Chưa chọn cỡ"
        elif size not in product.sizes:
            fields[f"{key}.size_label"] = "Cỡ không thuộc sản phẩm"
        if colour not in product.colours:
            fields[f"{key}.colour"] = "Màu không thuộc sản phẩm"
        if not 1 <= qty <= 20:
            fields[f"{key}.qty"] = "Số lượng từ 1 đến 20"
        planned.append((kit_index, slot_id, product_id, size or "", colour, qty))

    kit_ids = [k.kit_id for k in kit_lines]
    if len(set(kit_ids)) != len(kit_ids):
        fields["kit_lines"] = "Bộ bị trùng, hãy tăng số lượng"
    for k, kit_line in enumerate(kit_lines):
        kit = kits.get(kit_line.kit_id)
        if kit is None:
            fields[f"kit_lines.{k}.kit_id"] = "Bộ không thuộc đợt"
            continue
        picks = {p.slot_id: p for p in kit_line.slots}
        slot_ids = {s.id for s in kit.slots}
        for n, extra in enumerate(kit_line.slots):
            if extra.slot_id not in slot_ids:
                fields[f"kit_lines.{k}.slots.{n}.slot_id"] = "Slot không thuộc bộ"
        if len(picks) != len(kit_line.slots):
            fields[f"kit_lines.{k}.slots"] = "Slot bị trùng"
        for slot_index, slot in enumerate(kit.slots):
            pick = picks.get(slot.id)
            key = f"kit_lines.{k}.slots.{slot_index}"
            product_id = (pick.product_id if pick else None) or suggest_option(
                slot.product_ids, gender_of, order.gender
            )
            if product_id not in slot.product_ids:
                fields[f"{key}.product_id"] = "Phương án không thuộc slot"
                continue
            size = (pick.size_label if pick else None) or kit_line.size_label or order.default_size
            plan(
                key,
                k,
                slot.id,
                product_id,
                size,
                prices[product_id].colour,
                slot.qty * kit_line.qty,
            )
    for n, item in enumerate(item_lines):
        key = f"item_lines.{n}"
        campaign_item = prices.get(item.product_id)
        if campaign_item is None or item.product_id not in products:
            fields[f"{key}.product_id"] = "Sản phẩm không thuộc đợt"
            continue
        colour = item.colour or campaign_item.colour
        if require_open and colour != campaign_item.colour:
            fields[f"{key}.colour"] = "Màu không thuộc đợt"
        plan(key, None, None, item.product_id, item.size_label, colour, item.qty)
    if fields:
        raise _invalid(fields)
    if not planned and (submit or order.status == SUBMITTED):
        raise _invalid({"lines": "Đơn phải có ít nhất một dòng"})

    kept: dict[tuple[uuid.UUID, str], list[int]] = defaultdict(list)
    if order.status == SUBMITTED:
        for line in order.lines:
            if line.unit_price is not None:
                kept[(line.product_id, line.colour)].append(line.unit_price)
    before = {**order_info(order), **_lines_snapshot(order)}
    order.lines.clear()
    await session.flush()
    order.kit_lines.clear()
    await session.flush()
    kit_rows = {
        k: OrderKitLine(kit_id=kit_line.kit_id, qty=kit_line.qty)
        for k, kit_line in enumerate(kit_lines)
    }
    order.kit_lines.extend(kit_rows.values())
    await session.flush()
    for kit_index, slot_id, product_id, size, colour, qty in planned:
        old = kept.get((product_id, colour))
        order.lines.append(
            OrderLine(
                kit_line_id=kit_rows[kit_index].id if kit_index is not None else None,
                slot_id=slot_id,
                product_id=product_id,
                size_label=size,
                colour=colour,
                qty=qty,
                unit_price=old.pop(0) if old else prices[product_id].unit_price,
            )
        )
    if submit and order.status != SUBMITTED:
        order.status = SUBMITTED
        order.submitted_at = datetime.now(UTC)
    order.updated_at = datetime.now(UTC)
    await session.flush()
    await audit.record(
        session, actor, "order.lines.replace", "order", order.id,
        before, {**order_info(order), **_lines_snapshot(order)},
    )  # fmt: skip
    await session.commit()
    bus.publish(TOPIC)
