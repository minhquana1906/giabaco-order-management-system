"""Parent portal use cases."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.errors import ApiError
from app.features.campaigns.models import OPEN, campaign_for_student, open_campaign_for_school
from app.features.campaigns.pricing import kit_price, suggest_option
from app.features.catalog.colours import COLOUR_HEX, COLOURS
from app.features.catalog.images import find_image
from app.features.catalog.models import Product, School, SchoolClass
from app.features.orders.lines import create_order, order_info, replace_order_lines
from app.features.orders.models import PARENT, Order
from app.features.parent_accounts.models import ParentStudentLink
from app.features.parent_portal.schemas import (
    Colour,
    Img,
    OrderIn,
    Ordering,
    OrderingCampaign,
    OrderingItem,
    OrderingKit,
    OrderingOption,
    OrderingSlot,
    OrderView,
    PublicProduct,
    PublicStudent,
    PublicTrial,
    ViewItemLine,
    ViewKitLine,
    ViewSlotPick,
)
from app.features.students.models import FittingTrial, Student
from app.features.students.size_guide import suggest

PARENT_ACTOR = "parent"


def _not_found() -> ApiError:
    return ApiError(404, "not_found", "Không tìm thấy học sinh")


async def student_by_token(session: AsyncSession, token: str) -> Student:
    """QR path: the token is the credential."""
    student = await session.scalar(
        select(Student).where(Student.portal_token == token, Student.deleted_at.is_(None))
    )
    if student is None:
        raise _not_found()
    return student


async def student_by_link(
    session: AsyncSession, parent_id: uuid.UUID, student_id: uuid.UUID
) -> Student:
    """Account path: only students linked to this parent exist for them."""
    student = await session.scalar(
        select(Student)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .where(
            Student.id == student_id,
            ParentStudentLink.parent_id == parent_id,
            Student.deleted_at.is_(None),
        )
    )
    if student is None:
        raise _not_found()
    return student


async def get_public_student(session: AsyncSession, student: Student) -> PublicStudent:
    """Minimal student view for parents."""
    school = await session.get(School, student.school_id)
    school_class = await session.get(SchoolClass, student.class_id)
    assert school is not None and school_class is not None
    products = (
        await session.scalars(select(Product).where(Product.active).order_by(Product.position))
    ).all()
    by_id = {p.id: p for p in products}
    trials = (
        await session.scalars(
            select(FittingTrial)
            .where(FittingTrial.student_id == student.id, FittingTrial.deleted_at.is_(None))
            .order_by(FittingTrial.tried_at, FittingTrial.id)
        )
    ).all()
    return PublicStudent(
        full_name=student.full_name,
        school_name=school.name,
        class_name=school_class.name,
        gender=student.gender,
        data_source=student.data_source,
        height_cm=float(student.height_cm),
        weight_kg=float(student.weight_kg),
        measured_at=student.measured_at,
        trials=[
            PublicTrial(
                product_code=by_id[t.product_id].code,
                product_name=by_id[t.product_id].name,
                size_label=t.size_label,
                fit=t.fit,
            )
            for t in trials
            if t.product_id in by_id
        ],
        products=[PublicProduct(code=p.code, name=p.name, sizes=p.sizes) for p in products],
        suggested_sizes=_suggested_sizes(student, products),
    )


def _suggested_sizes(student: Student, products: list[Product] | Any) -> dict[str, str | None]:
    return {
        p.code: suggest(float(student.height_cm), float(student.weight_kg), p.size_guide, p.sizes)
        for p in products
    }


async def _order_of(
    session: AsyncSession, campaign_id: uuid.UUID, student_id: uuid.UUID
) -> Order | None:
    return await session.scalar(
        select(Order).where(
            Order.campaign_id == campaign_id,
            Order.student_id == student_id,
            Order.deleted_at.is_(None),
        )
    )


def _order_view(order: Order) -> OrderView:
    kit_lines = []
    for kit_line in order.kit_lines:
        lines = [line for line in order.lines if line.kit_line_id == kit_line.id]
        kit_lines.append(
            ViewKitLine(
                kit_id=kit_line.kit_id,
                qty=kit_line.qty,
                size_label=lines[0].size_label if lines else None,
                slots=[
                    ViewSlotPick(
                        slot_id=line.slot_id,
                        product_id=line.product_id,
                        size_label=line.size_label,
                        colour=line.colour,
                    )
                    for line in lines
                    if line.slot_id is not None
                ],
            )
        )
    totals = order.totals
    return OrderView(
        id=order.id,
        code=order.code,
        status=order.status,
        total=totals.amount,
        has_unpriced=totals.has_unpriced,
        submitted_at=order.submitted_at,
        kit_lines=kit_lines,
        item_lines=[
            ViewItemLine(
                product_id=line.product_id,
                size_label=line.size_label,
                colour=line.colour,
                qty=line.qty,
            )
            for line in order.lines
            if line.kit_line_id is None
        ],
    )


def _colour(code: str) -> Colour:
    return Colour(code=code, label=COLOURS.get(code, code), hex=COLOUR_HEX.get(code, "#d4d4d8"))


async def get_ordering(session: AsyncSession, student: Student) -> Ordering:
    campaign = await campaign_for_student(session, student.school_id, student.id)
    if campaign is None:
        return Ordering(campaign=None, kits=[], items=[], suggested_sizes={}, order=None)
    wanted = {i.product_id for i in campaign.items}
    for kit in campaign.kits:
        wanted |= {p for slot in kit.slots for p in slot.product_ids}
    products = {
        p.id: p
        for p in (await session.scalars(select(Product).where(Product.id.in_(wanted)))).all()
    }
    campaign_items = {i.product_id: i for i in campaign.items}
    gender = student.gender.value
    gender_of = {pid: p.gender_target for pid, p in products.items()}

    async def image(product_id: uuid.UUID) -> Img | None:
        item = campaign_items.get(product_id)
        colour = item.colour if item else products[product_id].colours[0]
        ref = await find_image(session, student.school_id, product_id, gender, colour)
        return Img(url=ref.url, width=ref.width, height=ref.height) if ref else None

    def colours(product_id: uuid.UUID) -> list[Colour]:
        item = campaign_items.get(product_id)
        return [_colour(item.colour if item else products[product_id].colours[0])]

    prices = {pid: i.unit_price for pid, i in campaign_items.items()}
    kits = []
    for kit in campaign.kits:
        slots = []
        selection = []
        for slot in kit.slots:
            if not slot.product_ids:
                continue
            chosen = suggest_option(slot.product_ids, gender_of, gender)
            selection.append((slot.qty, chosen))
            slots.append(
                OrderingSlot(
                    id=slot.id,
                    label=slot.label,
                    qty=slot.qty,
                    options=[
                        OrderingOption(
                            product_id=pid,
                            code=products[pid].code,
                            name=products[pid].name,
                            sizes=products[pid].sizes,
                            colours=colours(pid),
                            image=await image(pid),
                            suggested=pid == chosen,
                        )
                        for pid in slot.product_ids
                    ],
                )
            )
        kits.append(
            OrderingKit(
                id=kit.id,
                name=kit.name,
                price=kit_price(selection, prices) if selection else None,
                image=await image(selection[0][1]) if selection else None,
                slots=slots,
            )
        )
    items = [
        OrderingItem(
            product_id=i.product_id,
            code=products[i.product_id].code,
            name=products[i.product_id].name,
            price=i.unit_price,
            sizes=products[i.product_id].sizes,
            colours=colours(i.product_id),
            image=await image(i.product_id),
        )
        for i in campaign.items
    ]
    order = await _order_of(session, campaign.id, student.id)
    return Ordering(
        campaign=OrderingCampaign(
            id=campaign.id,
            name=campaign.name,
            status=campaign.status,
            closes_at=campaign.closes_at,
        ),
        kits=kits,
        items=items,
        suggested_sizes=_suggested_sizes(student, products.values()),
        order=_order_view(order) if order else None,
    )


async def _refresh_snapshot(
    session: AsyncSession, order: Order, student: Student, actor: str
) -> None:
    school_class = await session.get(SchoolClass, student.class_id)
    assert school_class is not None
    before = order_info(order)
    order.recipient_name = student.full_name
    order.gender = student.gender.value
    order.class_label = school_class.name
    order.parent_name = student.parent_name
    order.parent_phone = student.parent_phone
    await session.flush()
    after = order_info(order)
    if after != before:
        await audit.record(session, actor, "order.update", "order", order.id, before, after)


async def submit_order(
    session: AsyncSession, student: Student, actor: str, payload: OrderIn
) -> Ordering:
    """Create or replace the student's order in the OPEN campaign and submit it."""
    campaign = await open_campaign_for_school(session, student.school_id)
    if campaign is None or campaign.status != OPEN:
        raise ApiError(409, "campaign_locked", "Đợt đăng ký đã đóng")
    campaign_id, student_id = campaign.id, student.id
    order = await _order_of(session, campaign_id, student_id)
    if order is not None:
        await _refresh_snapshot(session, order, student, actor)
    else:
        school_class = await session.get(SchoolClass, student.class_id)
        assert school_class is not None
        try:
            order = await create_order(
                session,
                campaign,
                recipient_name=student.full_name,
                source=PARENT,
                actor=actor,
                student_id=student_id,
                parent_name=student.parent_name,
                parent_phone=student.parent_phone,
                gender=student.gender.value,
                class_label=school_class.name,
            )
        except ApiError as exc:
            if exc.code != "order_exists":
                raise
            await session.refresh(student)
            order = await _order_of(session, campaign_id, student_id)
            if order is None:
                raise
            await _refresh_snapshot(session, order, student, actor)
    await replace_order_lines(
        session, order, payload.kit_lines, payload.item_lines, actor, submit=True, require_open=True
    )
    return await get_ordering(session, student)
