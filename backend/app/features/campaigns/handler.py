"""Campaign queries, FSM and item/kit replacement."""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.errors import ApiError
from app.features.campaigns.models import (
    DRAFT,
    LOCKED,
    OPEN,
    Campaign,
    CampaignItem,
    CampaignKit,
    KitSlot,
    KitSlotOption,
)
from app.features.campaigns.schemas import (
    CampaignIn,
    CampaignOut,
    CampaignSummary,
    CampaignUpdate,
    ItemsIn,
    KitsIn,
)
from app.features.catalog.models import Product, School

logger = logging.getLogger("app.campaigns")

TRANSITIONS = {"open": (DRAFT, OPEN), "lock": (OPEN, LOCKED), "reopen": (LOCKED, OPEN)}
ACTION_TEXT = {"open": "mở", "lock": "khóa", "reopen": "mở lại"}
STATUS_TEXT = {DRAFT: "nháp", OPEN: "mở", LOCKED: "khóa"}
USED_PRODUCTS = (
    "SELECT DISTINCT ol.product_id FROM order_lines ol JOIN orders o ON o.id = ol.order_id "
    "WHERE o.campaign_id = :campaign_id AND o.deleted_at IS NULL"
)
USED_KITS = (
    "SELECT DISTINCT kl.kit_id FROM order_kit_lines kl JOIN orders o ON o.id = kl.order_id "
    "WHERE o.campaign_id = :campaign_id"
)


def _invalid(fields: dict[str, str]) -> ApiError:
    return ApiError(422, "validation_error", "Dữ liệu không hợp lệ", fields)


def _locked() -> ApiError:
    return ApiError(
        409, "campaign_locked", "Đợt đã khóa nên không thể sửa. Mở lại đợt để chỉnh sửa."
    )


def _in_use(message: str) -> ApiError:
    return ApiError(409, "in_use", message)


async def _get(session: AsyncSession, campaign_id: uuid.UUID, lock: bool = False) -> Campaign:
    query = (
        select(Campaign).where(Campaign.id == campaign_id).execution_options(populate_existing=True)
    )
    campaign = await session.scalar(query.with_for_update() if lock else query)
    if campaign is None:
        raise ApiError(
            404, "not_found", "Đợt này không tồn tại hoặc đã bị xóa. Quay lại danh sách."
        )
    return campaign


def _info(campaign: Campaign) -> dict[str, Any]:
    return {
        "school_id": str(campaign.school_id),
        "name": campaign.name,
        "school_year": campaign.school_year,
        "opens_at": campaign.opens_at.isoformat(),
        "closes_at": campaign.closes_at.isoformat() if campaign.closes_at else None,
        "status": campaign.status,
    }


def _items_snapshot(campaign: Campaign) -> list[dict[str, Any]]:
    return [
        {
            "product_id": str(i.product_id),
            "unit_price": i.unit_price,
            "colour": i.colour,
            "sort": i.sort,
        }
        for i in campaign.items
    ]


def _kit_shape(kit: CampaignKit) -> dict[str, Any]:
    return {
        "code": kit.code,
        "name": kit.name,
        "slots": [
            {"label": s.label, "qty": s.qty, "product_ids": [str(p) for p in s.product_ids]}
            for s in kit.slots
        ],
    }


async def _usage(
    session: AsyncSession, campaign_id: uuid.UUID
) -> tuple[set[uuid.UUID], set[uuid.UUID]]:
    """Products and kits that orders of this campaign already reference."""
    params = {"campaign_id": campaign_id}
    products = {r[0] for r in await session.execute(text(USED_PRODUCTS), params)}
    kits = {r[0] for r in await session.execute(text(USED_KITS), params)}
    return products, kits


async def _out(session: AsyncSession, campaign_id: uuid.UUID) -> CampaignOut:
    return CampaignOut.model_validate(await _get(session, campaign_id))


async def list_campaigns(
    session: AsyncSession, school_id: uuid.UUID | None
) -> list[CampaignSummary]:
    query = select(Campaign).order_by(Campaign.opens_at.desc(), Campaign.created_at.desc())
    if school_id is not None:
        query = query.where(Campaign.school_id == school_id)
    return [
        CampaignSummary(
            id=c.id,
            school_id=c.school_id,
            name=c.name,
            school_year=c.school_year,
            opens_at=c.opens_at,
            closes_at=c.closes_at,
            status=c.status,
            updated_at=c.updated_at,
            item_count=len(c.items),
            kit_count=len(c.kits),
        )
        for c in (await session.scalars(query)).all()
    ]


async def get_campaign(session: AsyncSession, campaign_id: uuid.UUID) -> CampaignOut:
    return await _out(session, campaign_id)


async def create_campaign(session: AsyncSession, payload: CampaignIn, actor: str) -> CampaignOut:
    if await session.get(School, payload.school_id) is None:
        raise ApiError(404, "not_found", "Trường này không còn trong hệ thống. Tải lại trang.")
    opens_at = payload.opens_at or datetime.now(UTC)
    if payload.closes_at and payload.closes_at <= opens_at:
        raise _invalid({"closes_at": "Hạn đăng ký phải sau thời điểm mở đợt."})
    campaign = Campaign(
        school_id=payload.school_id,
        name=payload.name,
        school_year=payload.school_year,
        opens_at=opens_at,
        closes_at=payload.closes_at,
        status=DRAFT,
    )
    session.add(campaign)
    await session.flush()
    await audit.record(
        session, actor, "campaign.create", "campaign", campaign.id, None, _info(campaign)
    )
    await session.commit()
    logger.info("campaigns.created", extra={"ctx": {"campaign_id": str(campaign.id)}})
    return await _out(session, campaign.id)


async def update_campaign(
    session: AsyncSession, campaign_id: uuid.UUID, payload: CampaignUpdate, actor: str
) -> CampaignOut:
    campaign = await _get(session, campaign_id, lock=True)
    before = _info(campaign)
    campaign.name = payload.name
    campaign.school_year = payload.school_year
    campaign.opens_at = payload.opens_at
    campaign.closes_at = payload.closes_at
    campaign.updated_at = datetime.now(UTC)
    await audit.record(
        session, actor, "campaign.update", "campaign", campaign.id, before, _info(campaign)
    )
    await session.commit()
    logger.info("campaigns.updated", extra={"ctx": {"campaign_id": str(campaign_id)}})
    return await _out(session, campaign_id)


async def transition(
    session: AsyncSession, campaign_id: uuid.UUID, action: str, actor: str
) -> CampaignOut:
    source, target = TRANSITIONS[action]
    campaign = await _get(session, campaign_id, lock=True)
    if campaign.status != source:
        logger.warning(
            "campaigns.invalid_transition",
            extra={
                "ctx": {
                    "campaign_id": str(campaign_id),
                    "action": action,
                    "status": campaign.status,
                }
            },
        )
        raise ApiError(
            409,
            "invalid_transition",
            f"Không thể {ACTION_TEXT[action]} khi đợt đang {STATUS_TEXT[campaign.status]}. "
            "Tải lại trang để xem trạng thái mới.",
        )
    if action == "open" and not campaign.items:
        raise ApiError(409, "no_items", "Thêm ít nhất một sản phẩm trước khi mở đợt.")
    if target == OPEN and await session.scalar(
        select(Campaign.id).where(
            Campaign.school_id == campaign.school_id,
            Campaign.status == OPEN,
            Campaign.id != campaign.id,
        )
    ):
        raise _open_conflict()
    before = _info(campaign)
    campaign.status = target
    campaign.updated_at = datetime.now(UTC)
    await audit.record(
        session, actor, f"campaign.{action}", "campaign", campaign.id, before, _info(campaign)
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise _open_conflict() from None
    logger.info(
        "campaigns.status_changed",
        extra={"ctx": {"campaign_id": str(campaign_id), "from": source, "to": target}},
    )
    return await _out(session, campaign_id)


def _open_conflict() -> ApiError:
    return ApiError(
        409,
        "school_has_open_campaign",
        "Trường này đã có đợt đang mở. Khóa đợt đó trước khi mở đợt khác.",
    )


async def replace_items(
    session: AsyncSession, campaign_id: uuid.UUID, payload: ItemsIn, actor: str
) -> CampaignOut:
    campaign = await _get(session, campaign_id, lock=True)
    if campaign.status == LOCKED:
        raise _locked()
    ids = [i.product_id for i in payload.items]
    if len(set(ids)) != len(ids):
        raise _invalid({"items": "Sản phẩm bị trùng trong danh sách"})
    products = {
        p.id: p for p in (await session.scalars(select(Product).where(Product.id.in_(ids)))).all()
    }
    existing = {i.product_id: i for i in campaign.items}
    fields: dict[str, str] = {}
    for index, item in enumerate(payload.items):
        product = products.get(item.product_id)
        if product is None:
            fields[f"items.{index}.product_id"] = "Không tìm thấy sản phẩm"
        elif item.product_id not in existing and not product.active:
            fields[f"items.{index}.product_id"] = "Sản phẩm đã ẩn"
        elif item.colour not in product.colours:
            fields[f"items.{index}.colour"] = "Màu không thuộc sản phẩm"
    if fields:
        raise _invalid(fields)
    removed = set(existing) - set(ids)
    in_kits = {p for kit in campaign.kits for slot in kit.slots for p in slot.product_ids}
    if removed & in_kits:
        raise _in_use("Sản phẩm đang nằm trong một bộ. Gỡ khỏi bộ trước rồi thử lại.")
    if campaign.status == OPEN:
        used, _ = await _usage(session, campaign_id)
        recoloured = {
            i.product_id
            for i in payload.items
            if i.product_id in existing and existing[i.product_id].colour != i.colour
        }
        if (removed | recoloured) & used:
            raise _in_use("Sản phẩm này đã có đơn nên không xóa hoặc đổi màu được.")
    before = _items_snapshot(campaign)
    for item in payload.items:
        row = existing.get(item.product_id)
        if row is None:
            campaign.items.append(
                CampaignItem(product_id=item.product_id, **item.model_dump(exclude={"product_id"}))
            )
        else:
            row.unit_price, row.colour, row.sort = item.unit_price, item.colour, item.sort
    for product_id in removed:
        campaign.items.remove(existing[product_id])
    campaign.updated_at = datetime.now(UTC)
    await session.flush()
    await audit.record(
        session, actor, "campaign.items.replace", "campaign", campaign.id,
        {"items": before}, {"items": _items_snapshot(campaign)},
    )  # fmt: skip
    await session.commit()
    logger.info(
        "campaigns.items_replaced",
        extra={"ctx": {"campaign_id": str(campaign_id), "count": len(payload.items)}},
    )
    return await _out(session, campaign_id)


async def replace_kits(
    session: AsyncSession, campaign_id: uuid.UUID, payload: KitsIn, actor: str
) -> CampaignOut:
    campaign = await _get(session, campaign_id, lock=True)
    if campaign.status == LOCKED:
        raise _locked()
    codes = [k.code for k in payload.kits]
    if len(set(codes)) != len(codes):
        raise _invalid({"kits": "Mã bộ bị trùng"})
    item_ids = {i.product_id for i in campaign.items}
    fields: dict[str, str] = {}
    for k, kit in enumerate(payload.kits):
        for s, slot in enumerate(kit.slots):
            if len(set(slot.product_ids)) != len(slot.product_ids):
                fields[f"kits.{k}.slots.{s}.product_ids"] = "Phương án bị trùng"
            elif not set(slot.product_ids) <= item_ids:
                fields[f"kits.{k}.slots.{s}.product_ids"] = "Phương án phải là sản phẩm của đợt"
    if fields:
        raise _invalid(fields)
    existing = {k.code: k for k in campaign.kits}
    incoming = {
        k.code: {
            "code": k.code,
            "name": k.name,
            "slots": [
                {"label": s.label, "qty": s.qty, "product_ids": [str(p) for p in s.product_ids]}
                for s in k.slots
            ],
        }
        for k in payload.kits
    }
    changed = {
        code
        for code, kit in existing.items()
        if code in incoming and _kit_shape(kit) != incoming[code]
    }
    removed = set(existing) - set(incoming)
    if campaign.status == OPEN:
        _, used_kits = await _usage(session, campaign_id)
        if {existing[c].id for c in removed | changed} & used_kits:
            raise _in_use("Bộ này đã có đơn nên không xóa hoặc sửa được.")
    before = [_kit_shape(k) for k in campaign.kits]
    for code in removed:
        campaign.kits.remove(existing[code])
    for index, body in enumerate(payload.kits):
        slots = [
            KitSlot(
                label=s.label,
                qty=s.qty,
                sort=n,
                options=[KitSlotOption(product_id=p) for p in s.product_ids],
            )
            for n, s in enumerate(body.slots)
        ]
        row = existing.get(body.code)
        if row is None:
            campaign.kits.append(
                CampaignKit(code=body.code, name=body.name, sort=index, slots=slots)
            )
            continue
        row.sort = index
        if body.code in changed:
            row.name = body.name
            row.slots = slots
    campaign.updated_at = datetime.now(UTC)
    await session.flush()
    await audit.record(
        session, actor, "campaign.kits.replace", "campaign", campaign.id,
        {"kits": before}, {"kits": [_kit_shape(k) for k in campaign.kits]},
    )  # fmt: skip
    await session.commit()
    logger.info(
        "campaigns.kits_replaced",
        extra={"ctx": {"campaign_id": str(campaign_id), "count": len(payload.kits)}},
    )
    return await _out(session, campaign_id)
