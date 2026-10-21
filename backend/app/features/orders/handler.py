"""Order use cases; every write to order lines goes through replace_order_lines."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import lazyload

from app.core import audit
from app.core.errors import ApiError
from app.core.events import bus
from app.features.campaigns.models import Campaign
from app.features.catalog.models import Product
from app.features.orders.lines import TOPIC, get_order, order_info, replace_order_lines
from app.features.orders.models import Order, OrderLine
from app.features.orders.schemas import (
    HistoryOut,
    KitLineOut,
    LineOut,
    LinesIn,
    OrderDetail,
    OrderPage,
    OrderSummary,
    OrderUpdate,
)

PAGE_SIZE = 50


async def update_order(
    session: AsyncSession, order_id: uuid.UUID, payload: OrderUpdate, actor: str
) -> OrderDetail:
    order = await get_order(session, order_id, lock=True)
    before = order_info(order)
    for name in payload.model_fields_set:
        setattr(order, name, getattr(payload, name))
    order.updated_at = datetime.now(UTC)
    await audit.record(session, actor, "order.update", "order", order.id, before, order_info(order))
    await session.commit()
    bus.publish(TOPIC)
    return await detail(session, order_id)


async def replace_lines_admin(
    session: AsyncSession, order_id: uuid.UUID, payload: LinesIn, actor: str
) -> OrderDetail:
    order = await get_order(session, order_id)
    await replace_order_lines(
        session, order, payload.kit_lines, payload.item_lines, actor, submit=payload.submit
    )
    return await detail(session, order_id)


def _summary(order: Order) -> dict[str, Any]:
    count, total, unpriced = order.totals
    return {**_summary_base(order), "item_count": count, "total": total, "has_unpriced": unpriced}


async def detail(session: AsyncSession, order_id: uuid.UUID) -> OrderDetail:
    order = await get_order(session, order_id)
    campaign = await session.get(Campaign, order.campaign_id)
    assert campaign is not None
    slot_labels = {s.id: s.label for k in campaign.kits for s in k.slots}
    kit_names = {k.id: k.name for k in campaign.kits}
    products = {
        p.id: p
        for p in (
            await session.scalars(
                select(Product).where(Product.id.in_({line.product_id for line in order.lines}))
            )
        ).all()
    }
    history = (
        await session.scalars(
            select(audit.AuditLog)
            .where(audit.AuditLog.entity == "order", audit.AuditLog.entity_id == order.id)
            .order_by(audit.AuditLog.at.desc(), audit.AuditLog.created_at.desc())
        )
    ).all()
    return OrderDetail(
        **_summary(order),
        campaign_id=order.campaign_id,
        campaign_status=campaign.status,
        student_id=order.student_id,
        parent_name=order.parent_name,
        parent_phone=order.parent_phone,
        default_size=order.default_size,
        note=order.note,
        kit_lines=[
            KitLineOut(id=k.id, kit_id=k.kit_id, kit_name=kit_names.get(k.kit_id, "—"), qty=k.qty)
            for k in order.kit_lines
        ],
        lines=[
            LineOut(
                id=line.id,
                kit_line_id=line.kit_line_id,
                slot_id=line.slot_id,
                slot_label=slot_labels.get(line.slot_id) if line.slot_id else None,
                product_id=line.product_id,
                product_name=products[line.product_id].name,
                sizes=products[line.product_id].sizes,
                colours=products[line.product_id].colours,
                size_label=line.size_label,
                colour=line.colour,
                qty=line.qty,
                unit_price=line.unit_price,
            )
            for line in order.lines
        ],
        history=[
            HistoryOut(at=h.at, actor=h.actor, action=h.action, before=h.before, after=h.after)
            for h in history
        ],
    )


async def list_orders(
    session: AsyncSession,
    campaign_id: uuid.UUID,
    q: str | None,
    gender: str | None,
    status: str | None,
    page: int,
) -> OrderPage:
    if await session.get(Campaign, campaign_id) is None:
        raise ApiError(404, "not_found", "Không tìm thấy đợt đăng ký")
    where = [Order.campaign_id == campaign_id, Order.deleted_at.is_(None)]
    if status:
        where.append(Order.status == status)
    if gender == "UNKNOWN":
        where.append(Order.gender.is_(None))
    elif gender:
        where.append(Order.gender == gender)
    if q and q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        where.append(
            or_(
                func.unaccent(func.lower(Order.recipient_name)).like(
                    func.unaccent(func.lower(pattern))
                ),
                func.lower(Order.code).like(func.lower(pattern)),
            )
        )
    total = await session.scalar(select(func.count()).select_from(Order).where(*where)) or 0
    stats = (
        select(
            OrderLine.order_id.label("order_id"),
            func.sum(OrderLine.qty).label("item_count"),
            func.coalesce(func.sum(OrderLine.qty * OrderLine.unit_price), 0).label("total"),
            func.bool_or(OrderLine.unit_price.is_(None)).label("has_unpriced"),
        )
        .where(OrderLine.order_id.in_(select(Order.id).where(Order.campaign_id == campaign_id)))
        .group_by(OrderLine.order_id)
        .subquery()
    )
    rows = await session.execute(
        select(
            Order,
            func.coalesce(stats.c.item_count, 0),
            func.coalesce(stats.c.total, 0),
            func.coalesce(stats.c.has_unpriced, False),
        )
        .outerjoin(stats, stats.c.order_id == Order.id)
        .options(lazyload(Order.lines), lazyload(Order.kit_lines))
        .where(*where)
        .order_by(Order.created_at.desc(), Order.code.desc())
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)
    )
    return OrderPage(
        items=[
            OrderSummary(
                **{
                    **_summary_base(o),
                    "item_count": int(count),
                    "total": int(amount),
                    "has_unpriced": bool(unpriced),
                }
            )
            for o, count, amount, unpriced in rows
        ],
        total=total,
        page=page,
        page_size=PAGE_SIZE,
    )


def _summary_base(order: Order) -> dict[str, Any]:
    return {
        "id": order.id,
        "code": order.code,
        "recipient_name": order.recipient_name,
        "class_label": order.class_label,
        "gender": order.gender,
        "status": order.status,
        "source": order.source,
        "submitted_at": order.submitted_at,
        "updated_at": order.updated_at,
    }
