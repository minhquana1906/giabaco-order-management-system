"""Order pivot and overview: the one read helper behind the stats endpoints and the export."""

import re
import uuid
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Any, Literal, NamedTuple

from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.features.campaigns.models import Campaign
from app.features.catalog.models import Product
from app.features.orders.models import SUBMITTED, Order, OrderKitLine, OrderLine
from app.features.students.models import Student

Measure = Literal["qty", "orders", "amount"]
Group = Literal["product", "kit", "class"]

UNKNOWN_CLASS = "Chưa rõ lớp"

VIETNAM = timezone(timedelta(hours=7))
GENDER_COLUMN = {"MALE": "male", "FEMALE": "female", None: "unknown"}


class GenderCounts(BaseModel):
    male: int
    female: int
    unknown: int
    total: int


class PivotRow(BaseModel):
    size_label: str
    male: int
    female: int
    unknown: int
    total: int
    qty: GenderCounts
    unpriced_qty: GenderCounts


class PivotTotals(BaseModel):
    male: int
    female: int
    unknown: int
    total: int
    qty: GenderCounts
    unpriced_qty: GenderCounts


class PivotBlock(BaseModel):
    id: str
    name: str
    orders: int
    rows: list[PivotRow]
    totals: PivotTotals


class CampaignPivot(BaseModel):
    sizes: list[str]
    blocks: list[PivotBlock]
    grand_total: int


class CampaignOverview(BaseModel):
    orders: int
    items: int
    amount: int
    unpriced_items: int
    priced_items: int
    students_total: int
    students_with_order: int
    by_source: dict[str, int]


class Fact(NamedTuple):
    block: uuid.UUID | str
    size: str
    column: str
    order_id: uuid.UUID
    qty: int
    amount: int
    unpriced: int


def submitted_orders(campaign_id: uuid.UUID, submitted_until: date | None = None) -> Select[Order]:
    query = select(Order).where(
        Order.campaign_id == campaign_id,
        Order.status == SUBMITTED,
        Order.deleted_at.is_(None),
    )
    if submitted_until is not None:
        cutoff = datetime.combine(submitted_until + timedelta(days=1), time.min, VIETNAM)
        query = query.where(Order.submitted_at < cutoff.astimezone(UTC))
    return query


async def campaign_or_404(session: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise ApiError(404, "not_found", "Không tìm thấy đợt")
    return campaign


def _kit_size(order: Order, lines: list[OrderLine]) -> str:
    """Common size of a kit line: the size most of its lines default to, else the order default."""
    if any(line.is_tailor for line in lines):
        return "May đo"
    counts = Counter(line.size_label for line in lines)
    top = max(counts.values())
    leaders = [size for size, n in counts.items() if n == top]
    return order.default_size if order.default_size in leaders else leaders[0]


def _facts(
    orders: Iterable[Order], group: Group, kit_id: uuid.UUID | None, product_id: uuid.UUID | None
) -> Iterable[Fact]:
    for order in orders:
        column = GENDER_COLUMN[order.gender]
        kit_of: dict[uuid.UUID, OrderKitLine] = {k.id: k for k in order.kit_lines}
        by_kit_line: dict[uuid.UUID, list[OrderLine]] = defaultdict(list)
        for line in order.lines:
            kit_line = kit_of.get(line.kit_line_id) if line.kit_line_id else None
            if kit_id is not None and (kit_line is None or kit_line.kit_id != kit_id):
                continue
            if product_id is not None and line.product_id != product_id:
                continue
            amount = line.qty * (line.unit_price or 0)
            unpriced = line.qty if line.unit_price is None else 0
            if group == "product":
                yield Fact(
                    line.product_id, line.size_label, column, order.id, line.qty, amount, unpriced
                )
            elif group == "class":
                yield Fact(
                    order.class_label or "",
                    line.size_label,
                    column,
                    order.id,
                    line.qty,
                    amount,
                    unpriced,
                )
            elif kit_line is not None:
                by_kit_line[kit_line.id].append(line)
        for kit_line_id, lines in by_kit_line.items():
            kit_line = kit_of[kit_line_id]
            amount = sum(line.qty * (line.unit_price or 0) for line in lines)
            unpriced = kit_line.qty if any(line.unit_price is None for line in lines) else 0
            size = _kit_size(order, lines)
            yield Fact(kit_line.kit_id, size, column, order.id, kit_line.qty, amount, unpriced)


def _natural_key(label: str) -> list[tuple[int, int, str]]:
    return [(0, int(t), "") if t.isdigit() else (1, 0, t) for t in re.split(r"(\d+)", label) if t]


def _ordered_union(*lists: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(size for sizes in lists for size in sizes))


async def campaign_pivot(
    session: AsyncSession,
    campaign_id: uuid.UUID,
    measure: Measure = "qty",
    group: Group = "product",
    *,
    kit_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
    submitted_until: date | None = None,
) -> CampaignPivot:
    campaign = await campaign_or_404(session, campaign_id)
    orders = (await session.scalars(submitted_orders(campaign_id, submitted_until))).all()
    product_ids = list(
        dict.fromkeys(
            [i.product_id for i in campaign.items]
            + [p for k in campaign.kits for s in k.slots for p in s.product_ids]
        )
    )
    products = {
        p.id: p for p in await session.scalars(select(Product).where(Product.id.in_(product_ids)))
    }

    def sizes_of(*ids: uuid.UUID) -> list[str]:
        return _ordered_union(*(products[i].sizes for i in ids if i in products))

    spec: list[tuple[uuid.UUID | str, str, list[str]]]
    if group == "product":
        spec = [
            (i.product_id, products[i.product_id].name, sizes_of(i.product_id))
            for i in campaign.items
            if product_id in (None, i.product_id)
        ]
    elif group == "kit":
        spec = [
            (k.id, k.name, sizes_of(*(p for s in k.slots for p in s.product_ids)))
            for k in campaign.kits
            if kit_id in (None, k.id)
        ]

    cells: dict[uuid.UUID | str, list[Fact]] = defaultdict(list)
    for fact in _facts(orders, group, kit_id, product_id):
        cells[fact.block].append(fact)
    if group == "class":
        known = sizes_of(*(product_ids if product_id is None else [product_id]))
        labels = sorted({str(k) for k in cells} - {""}, key=_natural_key)
        spec = [(label, label, known) for label in labels]
        if "" in cells:
            spec.append(("", UNKNOWN_CLASS, known))

    value: Callable[[list[Fact]], int] = {
        "qty": lambda facts: sum(f.qty for f in facts),
        "amount": lambda facts: sum(f.amount for f in facts),
        "orders": lambda facts: len({f.order_id for f in facts}),
    }[measure]

    def split(facts: list[Fact], pick: Callable[[Fact], int]) -> dict[str, int]:
        by_column = {
            c: sum(pick(f) for f in facts if f.column == c) for c in GENDER_COLUMN.values()
        }
        return {**by_column, "total": sum(pick(f) for f in facts)}

    def totals(facts: list[Fact]) -> dict[str, Any]:
        by_column = {c: value([f for f in facts if f.column == c]) for c in GENDER_COLUMN.values()}
        return {
            **by_column,
            "total": value(facts),
            "qty": split(facts, lambda f: f.qty),
            "unpriced_qty": split(facts, lambda f: f.unpriced),
        }

    blocks: list[PivotBlock] = []
    for block_id, name, known in spec:
        facts = cells.get(block_id, [])
        seen = sorted({f.size for f in facts} - set(known))
        rows = [
            PivotRow(size_label=size, **totals([f for f in facts if f.size == size]))
            for size in [*known, *seen]
        ]
        blocks.append(
            PivotBlock(
                id=str(block_id),
                name=name,
                orders=len({f.order_id for f in facts}),
                rows=rows,
                totals=PivotTotals(**totals(facts)),
            )
        )
    return CampaignPivot(
        sizes=_ordered_union(*([r.size_label for r in b.rows] for b in blocks)),
        blocks=blocks,
        grand_total=value([f for b in spec for f in cells.get(b[0], [])]),
    )


async def campaign_overview(
    session: AsyncSession, campaign_id: uuid.UUID, submitted_until: date | None = None
) -> CampaignOverview:
    campaign = await campaign_or_404(session, campaign_id)
    orders = (await session.scalars(submitted_orders(campaign_id, submitted_until))).all()
    students_total = await session.scalar(
        select(func.count())
        .select_from(Student)
        .where(Student.school_id == campaign.school_id, Student.deleted_at.is_(None))
    )
    lines = [line for order in orders for line in order.lines]
    totals = [order.totals for order in orders]
    return CampaignOverview(
        orders=len(orders),
        items=sum(t.items for t in totals),
        amount=sum(t.amount for t in totals),
        unpriced_items=sum(line.qty for line in lines if line.unit_price is None),
        priced_items=sum(line.qty for line in lines if line.unit_price is not None),
        students_total=students_total or 0,
        students_with_order=len({o.student_id for o in orders if o.student_id is not None}),
        by_source=dict(Counter(order.source for order in orders)),
    )
