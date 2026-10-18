"""Parent portal use cases."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.errors import ApiError
from app.core.events import bus
from app.features.catalog.models import Product, School, SchoolClass
from app.features.parent_portal.models import ParentSizeChoice
from app.features.parent_portal.schemas import (
    ChoiceOut,
    PublicProduct,
    PublicStudent,
    PublicTrial,
)
from app.features.students.models import FittingTrial, Student

PARENT_ACTOR = "parent"


async def _student_by_token(session: AsyncSession, token: str) -> Student:
    student = await session.scalar(
        select(Student).where(Student.portal_token == token, Student.deleted_at.is_(None))
    )
    if student is None:
        raise ApiError(404, "not_found", "Không tìm thấy học sinh")
    return student


async def _active_product(session: AsyncSession, code: str) -> Product:
    product = await session.scalar(select(Product).where(Product.code == code, Product.active))
    if product is None:
        raise ApiError(404, "not_found", "Không tìm thấy sản phẩm")
    return product


async def get_public_student(session: AsyncSession, token: str) -> PublicStudent:
    """Minimal student view for parents."""
    student = await _student_by_token(session, token)
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
    choices = (
        await session.scalars(
            select(ParentSizeChoice).where(ParentSizeChoice.student_id == student.id)
        )
    ).all()
    return PublicStudent(
        full_name=student.full_name,
        school_name=school.name,
        class_name=school_class.name,
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
        choices={by_id[c.product_id].code: c.size_label for c in choices if c.product_id in by_id},
    )


async def set_choice(
    session: AsyncSession, token: str, product_code: str, size_label: str
) -> ChoiceOut:
    """Upsert the parent's size choice for a product."""
    student = await _student_by_token(session, token)
    product = await _active_product(session, product_code)
    if size_label not in product.sizes:
        raise ApiError(
            422, "validation_error", "Cỡ không thuộc sản phẩm", {"size_label": "Cỡ không hợp lệ"}
        )
    choice = await session.scalar(
        select(ParentSizeChoice).where(
            ParentSizeChoice.student_id == student.id, ParentSizeChoice.product_id == product.id
        )
    )
    before = {"size_label": choice.size_label} if choice else None
    chosen_at = datetime.now(UTC)
    stmt = pg_insert(ParentSizeChoice).values(
        student_id=student.id, product_id=product.id, size_label=size_label, chosen_at=chosen_at
    )
    choice_id = await session.scalar(
        stmt.on_conflict_do_update(
            index_elements=["student_id", "product_id"],
            set_={"size_label": size_label, "chosen_at": chosen_at},
        ).returning(ParentSizeChoice.id)
    )
    assert choice_id is not None
    await audit.record(
        session, PARENT_ACTOR, "choice.set", "parent_size_choice", choice_id, before,
        {"product_code": product_code, "size_label": size_label},
    )  # fmt: skip
    await session.commit()
    bus.publish("choices")
    return ChoiceOut(product_code=product_code, size_label=size_label, chosen_at=chosen_at)


async def clear_choice(session: AsyncSession, token: str, product_code: str) -> None:
    """Remove the parent's choice; idempotent."""
    student = await _student_by_token(session, token)
    product = await _active_product(session, product_code)
    choice = await session.scalar(
        select(ParentSizeChoice).where(
            ParentSizeChoice.student_id == student.id, ParentSizeChoice.product_id == product.id
        )
    )
    if choice is None:
        return
    before = {"product_code": product_code, "size_label": choice.size_label}
    await session.delete(choice)
    await audit.record(
        session, PARENT_ACTOR, "choice.clear", "parent_size_choice", choice.id, before, None
    )
    await session.commit()
    bus.publish("choices")
