"""Parent account use cases."""

import secrets
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core import audit
from app.core.errors import ApiError
from app.core.events import bus
from app.core.names import lock_identity, name_key
from app.core.phone import normalize_phone
from app.core.security import PARENT_SESSION_KEY, hash_password, parent_actor, verify_password
from app.features.catalog.models import Product, School, SchoolClass
from app.features.parent_accounts.models import LinkOrigin, ParentAccount, ParentStudentLink
from app.features.parent_accounts.schemas import (
    ChildChoice,
    ChildIn,
    ChildKeyIn,
    ChildSummary,
    ChildUpdateIn,
    LoginIn,
    LookupOut,
    ParentAccountOut,
    RegisterIn,
)
from app.features.parent_portal.models import ParentSizeChoice
from app.features.students.models import DataSource, Student, student_snapshot

MAX_CHILDREN = 10


def _unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Cần đăng nhập")


def account_out(parent: ParentAccount) -> ParentAccountOut:
    return ParentAccountOut(
        id=parent.id, full_name=parent.full_name, email=parent.email, phone=parent.phone
    )


async def load_parent(session: AsyncSession, parent_id: uuid.UUID) -> ParentAccount:
    """The signed-in account; a cookie for a vanished account is unauthorized."""
    parent = await session.get(ParentAccount, parent_id)
    if parent is None:
        raise _unauthorized()
    return parent


async def register(session: AsyncSession, request: Request, payload: RegisterIn) -> ParentAccount:
    """Create the account and sign it in."""
    if payload.email is None and payload.phone is None:
        raise ApiError(
            422,
            "validation_error",
            "Cần email hoặc số điện thoại",
            {"email": "Nhập email hoặc số điện thoại"},
        )
    parent = ParentAccount(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=await run_in_threadpool(hash_password, payload.password),
    )
    session.add(parent)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "account_exists", "Email hoặc số điện thoại đã được đăng ký") from None
    await audit.record(
        session, parent_actor(parent.id), "parent_account.register", "parent_account", parent.id,
        None, {"has_email": parent.email is not None, "has_phone": parent.phone is not None},
    )  # fmt: skip
    await session.commit()
    request.session[PARENT_SESSION_KEY] = str(parent.id)
    return parent


async def _find_by_identifier(session: AsyncSession, identifier: str) -> ParentAccount | None:
    identifier = identifier.strip()
    if "@" in identifier:
        condition = ParentAccount.email == identifier.lower()
    else:
        try:
            condition = ParentAccount.phone == normalize_phone(identifier)
        except ValueError:
            return None
    return await session.scalar(select(ParentAccount).where(condition))


async def login(session: AsyncSession, request: Request, payload: LoginIn) -> ParentAccount:
    """Verify credentials; a missing account costs the same hash as a wrong password."""
    parent = await _find_by_identifier(session, payload.identifier)
    password_ok = await run_in_threadpool(
        verify_password, parent.password_hash if parent else None, payload.password
    )
    if parent is None or not password_ok:
        raise ApiError(401, "invalid_credentials", "Sai thông tin đăng nhập")
    request.session[PARENT_SESSION_KEY] = str(parent.id)
    return parent


async def children(
    session: AsyncSession, parent_id: uuid.UUID, student_id: uuid.UUID | None = None
) -> list[ChildSummary]:
    """Linked, live students of one parent with their current size choices."""
    query = (
        select(Student, School.name, SchoolClass.name)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .join(School, School.id == Student.school_id)
        .join(SchoolClass, SchoolClass.id == Student.class_id)
        .where(ParentStudentLink.parent_id == parent_id, Student.deleted_at.is_(None))
        .order_by(ParentStudentLink.created_at, ParentStudentLink.id)
    )
    if student_id is not None:
        query = query.where(Student.id == student_id)
    rows = (await session.execute(query)).all()
    choices: dict[uuid.UUID, list[ChildChoice]] = defaultdict(list)
    if rows:
        chosen = await session.execute(
            select(
                ParentSizeChoice.student_id, Product.code, Product.name, ParentSizeChoice.size_label
            )
            .join(Product, Product.id == ParentSizeChoice.product_id)
            .where(ParentSizeChoice.student_id.in_([s.id for s, _, _ in rows]), Product.active)
            .order_by(Product.position, Product.code)
        )
        for sid, code, name, label in chosen:
            choices[sid].append(ChildChoice(product_code=code, product_name=name, size_label=label))
    declared = DataSource.PARENT_DECLARED
    return [
        ChildSummary(
            student_id=s.id,
            full_name=s.full_name,
            school_id=s.school_id,
            school_name=school_name,
            class_id=s.class_id,
            class_name=class_name,
            gender=s.gender,
            data_source=s.data_source,
            parent_name=s.parent_name if s.data_source is declared else None,
            parent_phone=s.parent_phone if s.data_source is declared else None,
            parent_email=s.parent_email if s.data_source is declared else None,
            choices=choices[s.id],
        )
        for s, school_name, class_name in rows
    ]


async def child(session: AsyncSession, parent_id: uuid.UUID, student_id: uuid.UUID) -> ChildSummary:
    """One linked child; a student gone since the request began reads as not found."""
    found = await children(session, parent_id, student_id)
    if not found:
        raise ApiError(404, "not_found", "Không tìm thấy học sinh")
    return found[0]


async def _matches(session: AsyncSession, key: ChildKeyIn) -> list[Student]:
    """Live students sharing school, normalized name and dob; two rows are enough to see a clash."""
    result = await session.scalars(
        select(Student)
        .where(
            Student.school_id == key.school_id,
            name_key(Student.full_name) == name_key(key.full_name),
            Student.dob == key.dob,
            Student.deleted_at.is_(None),
        )
        .order_by(Student.created_at, Student.id)
        .limit(2)
    )
    return list(result)


async def lookup(session: AsyncSession, key: ChildKeyIn) -> LookupOut:
    """Tell a parent whether a record matches, without any measurement or contact detail."""
    matches = await _matches(session, key)
    if not matches:
        return LookupOut(found=False)
    if len(matches) > 1:
        return LookupOut(found=True, ambiguous=True)
    student = matches[0]
    school = await session.get(School, student.school_id)
    school_class = await session.get(SchoolClass, student.class_id)
    assert school is not None and school_class is not None
    return LookupOut(
        found=True,
        ambiguous=False,
        full_name=student.full_name,
        school_name=school.name,
        class_name=school_class.name,
    )


async def claim(session: AsyncSession, parent: ParentAccount, key: ChildKeyIn) -> ChildSummary:
    """Link the parent to the single matching student; repeating the claim changes nothing."""
    await lock_identity(session, key.school_id, key.full_name, key.dob)
    matches = await _matches(session, key)
    if not matches:
        raise ApiError(404, "no_match", "Không tìm thấy hồ sơ phù hợp")
    if len(matches) > 1:
        raise ApiError(
            409, "ambiguous_match", "Có nhiều hồ sơ trùng khớp, vui lòng liên hệ Giabaco"
        )
    student = matches[0]
    link_id = await session.scalar(
        pg_insert(ParentStudentLink)
        .values(parent_id=parent.id, student_id=student.id, origin=LinkOrigin.CLAIMED)
        .on_conflict_do_nothing(index_elements=["parent_id", "student_id"])
        .returning(ParentStudentLink.id)
    )
    if link_id is not None:
        await audit.record(
            session, parent_actor(parent.id), "parent_student_link.create", "parent_student_link",
            link_id, None,
            {"parent_id": str(parent.id), "student_id": str(student.id), "origin": "CLAIMED"},
        )  # fmt: skip
        await session.commit()
        bus.publish("students")
    return await child(session, parent.id, student.id)


async def list_schools(session: AsyncSession) -> Sequence[School]:
    return (await session.scalars(select(School).order_by(School.name))).all()


async def list_classes(session: AsyncSession, school_id: uuid.UUID) -> Sequence[SchoolClass]:
    if await session.get(School, school_id) is None:
        raise ApiError(404, "not_found", "Không tìm thấy trường")
    result = await session.scalars(
        select(SchoolClass)
        .where(SchoolClass.school_id == school_id)
        .order_by(SchoolClass.grade, SchoolClass.name)
    )
    return result.all()


async def check_class(session: AsyncSession, school_id: uuid.UUID, class_id: uuid.UUID) -> None:
    found = await session.scalar(
        select(SchoolClass.id).where(SchoolClass.id == class_id, SchoolClass.school_id == school_id)
    )
    if found is None:
        raise ApiError(
            422,
            "validation_error",
            "Lớp không thuộc trường đã chọn",
            {"class_id": "Lớp không thuộc trường đã chọn"},
        )


async def _linked_count(session: AsyncSession, parent_id: uuid.UUID) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(ParentStudentLink)
        .join(Student, Student.id == ParentStudentLink.student_id)
        .where(ParentStudentLink.parent_id == parent_id, Student.deleted_at.is_(None))
    )
    return int(count or 0)


async def create_child(
    session: AsyncSession, parent: ParentAccount, payload: ChildIn
) -> ChildSummary:
    """Create a self-declared record and link it to the parent, unless the child already exists."""
    await check_class(session, payload.school_id, payload.class_id)
    await lock_identity(session, payload.school_id, payload.full_name, payload.dob)
    if await _matches(session, payload):
        await session.rollback()
        raise ApiError(
            409, "child_exists", "Hồ sơ của con đã có, hãy dùng chức năng tìm hồ sơ để nhận"
        )
    await session.execute(
        select(ParentAccount.id)
        .where(ParentAccount.id == parent.id)
        .with_for_update(key_share=True)
    )
    if await _linked_count(session, parent.id) >= MAX_CHILDREN:
        await session.rollback()
        raise ApiError(
            409,
            "child_limit",
            f"Mỗi tài khoản chỉ liên kết tối đa {MAX_CHILDREN} hồ sơ con, vui lòng liên hệ Giabaco",
        )
    student = Student(
        school_id=payload.school_id,
        class_id=payload.class_id,
        full_name=payload.full_name,
        dob=payload.dob,
        gender=payload.gender,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        parent_name=payload.parent_name,
        parent_phone=payload.parent_phone,
        parent_email=payload.parent_email,
        portal_token=secrets.token_urlsafe(16),
        data_source=DataSource.PARENT_DECLARED,
    )
    session.add(student)
    await session.flush()
    link = ParentStudentLink(parent_id=parent.id, student_id=student.id, origin=LinkOrigin.CREATED)
    session.add(link)
    await session.flush()
    actor = parent_actor(parent.id)
    await audit.record(
        session, actor, "student.create", "student", student.id, None, student_snapshot(student)
    )
    await audit.record(
        session, actor, "parent_student_link.create", "parent_student_link", link.id, None,
        {"parent_id": str(parent.id), "student_id": str(student.id), "origin": "CREATED"},
    )  # fmt: skip
    await session.commit()
    bus.publish("students")
    return await child(session, parent.id, student.id)


async def update_child(
    session: AsyncSession, parent: ParentAccount, student_id: uuid.UUID, payload: ChildUpdateIn
) -> ChildSummary:
    """Edit a linked, self-declared record; admin-measured records are locked."""
    student = await session.scalar(
        select(Student)
        .join(ParentStudentLink, ParentStudentLink.student_id == Student.id)
        .where(
            Student.id == student_id,
            ParentStudentLink.parent_id == parent.id,
            Student.deleted_at.is_(None),
        )
        .with_for_update(of=Student)
    )
    if student is None:
        raise ApiError(404, "not_found", "Không tìm thấy học sinh")
    if student.data_source is not DataSource.PARENT_DECLARED:
        raise ApiError(409, "measured_locked", "Hồ sơ đã được Giabaco đo, không thể sửa")
    await check_class(session, student.school_id, payload.class_id)
    before = student_snapshot(student)
    student.class_id = payload.class_id
    student.gender = payload.gender
    student.height_cm = payload.height_cm
    student.weight_kg = payload.weight_kg
    student.parent_name = payload.parent_name
    student.parent_phone = payload.parent_phone
    student.parent_email = payload.parent_email
    student.measured_at = datetime.now(UTC)
    await session.flush()
    await audit.record(
        session, parent_actor(parent.id), "student.update", "student", student.id, before,
        student_snapshot(student),
    )  # fmt: skip
    await session.commit()
    bus.publish("students")
    return await child(session, parent.id, student.id)


async def unlink(
    session: AsyncSession, student_id: uuid.UUID, parent_id: uuid.UUID, actor: str
) -> None:
    """Admin removes a parent's link; size choices already made stay."""
    link = await session.scalar(
        select(ParentStudentLink).where(
            ParentStudentLink.student_id == student_id, ParentStudentLink.parent_id == parent_id
        )
    )
    if link is None:
        raise ApiError(404, "not_found", "Không tìm thấy liên kết")
    before = {
        "parent_id": str(link.parent_id),
        "student_id": str(link.student_id),
        "origin": link.origin.value,
    }
    await session.delete(link)
    await audit.record(
        session, actor, "parent_student_link.delete", "parent_student_link", link.id, before, None
    )
    await session.commit()
    bus.publish("students")
