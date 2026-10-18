"""Catalog queries and mutations."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.features.catalog.models import Product, School, SchoolClass
from app.features.catalog.schemas import ClassIn, SchoolIn, SchoolUpdate


async def list_products(session: AsyncSession) -> Sequence[Product]:
    """Active products in seed order."""
    result = await session.scalars(
        select(Product).where(Product.active).order_by(Product.position, Product.code)
    )
    return result.all()


async def list_schools(session: AsyncSession) -> Sequence[School]:
    result = await session.scalars(select(School).order_by(School.name))
    return result.all()


async def create_school(session: AsyncSession, payload: SchoolIn) -> School:
    school = School(name=payload.name, code=payload.code)
    session.add(school)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "duplicate_school", f"Mã trường {payload.code} đã tồn tại") from None
    return school


async def _get_school(session: AsyncSession, school_id: uuid.UUID) -> School:
    school = await session.get(School, school_id)
    if school is None:
        raise ApiError(404, "not_found", "Không tìm thấy trường")
    return school


async def list_classes(session: AsyncSession, school_id: uuid.UUID) -> Sequence[SchoolClass]:
    await _get_school(session, school_id)
    result = await session.scalars(
        select(SchoolClass)
        .where(SchoolClass.school_id == school_id)
        .order_by(SchoolClass.grade, SchoolClass.name)
    )
    return result.all()


async def create_class(
    session: AsyncSession, school_id: uuid.UUID, payload: ClassIn
) -> SchoolClass:
    await _get_school(session, school_id)
    school_class = SchoolClass(school_id=school_id, grade=payload.grade, name=payload.name)
    session.add(school_class)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "duplicate_class", f"Lớp {payload.name} đã tồn tại") from None
    return school_class


async def update_school(
    session: AsyncSession, school_id: uuid.UUID, payload: SchoolUpdate
) -> School:
    school = await _get_school(session, school_id)
    school.name = payload.name
    await session.commit()
    return school


async def update_class(
    session: AsyncSession, school_id: uuid.UUID, class_id: uuid.UUID, payload: ClassIn
) -> SchoolClass:
    school_class = await session.get(SchoolClass, class_id)
    if school_class is None or school_class.school_id != school_id:
        raise ApiError(404, "not_found", "Không tìm thấy lớp")
    school_class.grade = payload.grade
    school_class.name = payload.name
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "duplicate_class", f"Lớp {payload.name} đã tồn tại") from None
    return school_class
