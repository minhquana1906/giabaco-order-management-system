"""Student and fitting-trial use cases."""

import re
import secrets
import unicodedata
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.events import bus
from app.features.catalog.models import Product, School, SchoolClass
from app.features.parent_accounts.models import ParentAccount, ParentStudentLink
from app.features.parent_portal.models import ParentSizeChoice
from app.features.students.fit_rules import derived_size
from app.features.students.models import Fit, FittingTrial, Student
from app.features.students.schemas import (
    ClassRef,
    LinkedParentOut,
    NamedRef,
    ParentChoiceOut,
    StudentDetail,
    StudentIn,
    StudentListItem,
    StudentPage,
    TrialIn,
    TrialOut,
)
from app.features.students.size_guide import suggest


def new_portal_token() -> str:
    """128-bit URL-safe token."""
    return secrets.token_urlsafe(16)


def _not_found() -> ApiError:
    return ApiError(404, "not_found", "Không tìm thấy học sinh")


def _trial_snapshot(trial: FittingTrial, code: str) -> dict[str, Any]:
    return {
        "id": str(trial.id),
        "product_code": code,
        "size_label": trial.size_label,
        "suggested_size_label": trial.suggested_size_label,
        "fit": trial.fit.value,
        "note": trial.note,
        "deleted_at": trial.deleted_at.isoformat() if trial.deleted_at else None,
    }


def _student_snapshot(student: Student) -> dict[str, Any]:
    return {
        "school_id": str(student.school_id),
        "class_id": str(student.class_id),
        "full_name": student.full_name,
        "dob": student.dob.isoformat(),
        "gender": student.gender.value,
        "height_cm": float(student.height_cm),
        "weight_kg": float(student.weight_kg),
        "parent_name": student.parent_name,
        "parent_phone": student.parent_phone,
        "parent_email": student.parent_email,
        "deleted_at": student.deleted_at.isoformat() if student.deleted_at else None,
    }


async def _products_by_code(session: AsyncSession) -> dict[str, Product]:
    return {p.code: p for p in (await session.scalars(select(Product))).all()}


async def _active_trials(session: AsyncSession, student_id: uuid.UUID) -> list[FittingTrial]:
    result = await session.scalars(
        select(FittingTrial)
        .where(FittingTrial.student_id == student_id, FittingTrial.deleted_at.is_(None))
        .order_by(FittingTrial.tried_at, FittingTrial.id)
    )
    return list(result.all())


async def _load_student(session: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await session.get(Student, student_id)
    if student is None or student.deleted_at is not None:
        raise _not_found()
    return student


async def _check_class(session: AsyncSession, payload: StudentIn) -> None:
    found = await session.scalar(
        select(SchoolClass.id).where(
            SchoolClass.id == payload.class_id, SchoolClass.school_id == payload.school_id
        )
    )
    if found is None:
        raise ApiError(
            422,
            "validation_error",
            "Lớp không thuộc trường đã chọn",
            {"class_id": "Lớp không thuộc trường đã chọn"},
        )


async def _check_duplicate(
    session: AsyncSession, payload: StudentIn, exclude_id: uuid.UUID | None
) -> None:
    query = select(Student.id).where(
        Student.school_id == payload.school_id,
        Student.class_id == payload.class_id,
        func.lower(func.trim(Student.full_name)) == payload.full_name.lower(),
        Student.dob == payload.dob,
        Student.deleted_at.is_(None),
    )
    if exclude_id is not None:
        query = query.where(Student.id != exclude_id)
    if await session.scalar(query.limit(1)) is not None:
        school_class = await session.get(SchoolClass, payload.class_id)
        class_name = school_class.name if school_class else ""
        raise ApiError(
            409,
            "duplicate_student",
            f"Học sinh {payload.full_name} đã có trong lớp {class_name}",
        )


def _validate_trials(
    trials: Sequence[TrialIn], products: dict[str, Product]
) -> list[tuple[TrialIn, Product]]:
    fields: dict[str, str] = {}
    resolved: list[tuple[TrialIn, Product]] = []
    seen: set[tuple[str, str]] = set()
    for i, trial in enumerate(trials):
        product = products.get(trial.product_code)
        if product is None:
            fields[f"trials.{i}.product_code"] = "Sản phẩm không tồn tại"
            continue
        if trial.size_label not in product.sizes:
            fields[f"trials.{i}.size_label"] = "Cỡ không thuộc sản phẩm"
            continue
        key = (trial.product_code, trial.size_label)
        if key in seen:
            raise ApiError(
                409,
                "duplicate_trial",
                f"Cỡ {trial.size_label} của {product.name} đã được thử",
            )
        seen.add(key)
        resolved.append((trial, product))
    if fields:
        raise ApiError(422, "validation_error", "Lần thử không hợp lệ", fields)
    return resolved


def _apply_fields(student: Student, payload: StudentIn) -> None:
    student.school_id = payload.school_id
    student.class_id = payload.class_id
    student.full_name = payload.full_name
    student.dob = payload.dob
    student.gender = payload.gender
    student.height_cm = payload.height_cm
    student.weight_kg = payload.weight_kg
    student.parent_name = payload.parent_name
    student.parent_phone = payload.parent_phone
    student.parent_email = payload.parent_email


def _suggestion(student: Student, product: Product) -> str | None:
    return suggest(
        float(student.height_cm), float(student.weight_kg), product.size_guide, product.sizes
    )


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "uq_fitting_trials_active" in str(exc.orig):
            raise ApiError(409, "duplicate_trial", "Cỡ này đã được thử") from None
        raise


async def create_student(session: AsyncSession, payload: StudentIn, actor: str) -> uuid.UUID:
    """Create a student with trials in a single transaction."""
    await _check_class(session, payload)
    products = await _products_by_code(session)
    resolved = _validate_trials(payload.trials, products)
    if not payload.force:
        await _check_duplicate(session, payload, None)
    student = Student(portal_token=new_portal_token())
    _apply_fields(student, payload)
    session.add(student)
    await session.flush()
    trials: list[tuple[FittingTrial, str]] = []
    for trial_in, product in resolved:
        trial = FittingTrial(
            student_id=student.id,
            product_id=product.id,
            size_label=trial_in.size_label,
            suggested_size_label=_suggestion(student, product),
            fit=trial_in.fit,
            note=trial_in.note,
        )
        session.add(trial)
        trials.append((trial, product.code))
    await session.flush()
    await audit.record(
        session, actor, "student.create", "student", student.id, None, _student_snapshot(student)
    )
    for trial, code in trials:
        await audit.record(
            session, actor, "trial.create", "fitting_trial", trial.id, None,
            _trial_snapshot(trial, code),
        )  # fmt: skip
    await _commit(session)
    bus.publish("students")
    return student.id


async def update_student(
    session: AsyncSession, student_id: uuid.UUID, payload: StudentIn, actor: str
) -> None:
    """Update student; trials with id update, without id insert, missing are soft-deleted."""
    student = await _load_student(session, student_id)
    await _check_class(session, payload)
    products = await _products_by_code(session)
    code_by_id = {p.id: p.code for p in products.values()}
    resolved = _validate_trials(payload.trials, products)
    if not payload.force:
        await _check_duplicate(session, payload, student.id)

    existing = {t.id: t for t in await _active_trials(session, student.id)}
    for i, (trial_in, _) in enumerate(resolved):
        if trial_in.id is not None and trial_in.id not in existing:
            raise ApiError(
                422,
                "validation_error",
                "Lần thử không thuộc học sinh",
                {f"trials.{i}.id": "Lần thử không tồn tại"},
            )
    before = _student_snapshot(student)
    now = datetime.now(UTC)
    kept_ids = {t.id for t, _ in resolved if t.id is not None}
    trial_audits: list[tuple[str, FittingTrial, dict[str, Any] | None]] = []
    old: dict[str, Any] | None
    for trial in existing.values():
        if trial.id not in kept_ids:
            old = _trial_snapshot(trial, code_by_id[trial.product_id])
            trial.deleted_at = now
            trial_audits.append(("trial.delete", trial, old))
    await session.flush()

    _apply_fields(student, payload)
    for trial_in, product in resolved:
        if trial_in.id is None:
            trial = FittingTrial(student_id=student.id, product_id=product.id, fit=trial_in.fit)
            session.add(trial)
            old = None
            action = "trial.create"
        else:
            trial = existing[trial_in.id]
            old = _trial_snapshot(trial, code_by_id[trial.product_id])
            action = "trial.update"
        trial.product_id = product.id
        trial.size_label = trial_in.size_label
        trial.fit = trial_in.fit
        trial.note = trial_in.note
        trial.suggested_size_label = _suggestion(student, product)
        trial_audits.append((action, trial, old))
    await session.flush()

    for action, trial, old in trial_audits:
        new = _trial_snapshot(trial, code_by_id[trial.product_id])
        if action == "trial.update" and old == new:
            continue
        await audit.record(
            session, actor, action, "fitting_trial", trial.id, old,
            None if action == "trial.delete" else new,
        )  # fmt: skip
    await audit.record(
        session, actor, "student.update", "student", student.id, before, _student_snapshot(student)
    )
    await _commit(session)
    bus.publish("students")


async def delete_student(session: AsyncSession, student_id: uuid.UUID, actor: str) -> None:
    """Soft delete a student."""
    student = await _load_student(session, student_id)
    before = _student_snapshot(student)
    student.deleted_at = datetime.now(UTC)
    await audit.record(
        session, actor, "student.delete", "student", student.id, before, _student_snapshot(student)
    )
    await _commit(session)
    bus.publish("students")


async def _derived_for(
    session: AsyncSession, trials_by_student: dict[uuid.UUID, list[FittingTrial]]
) -> tuple[dict[uuid.UUID, dict[str, str | None]], dict[uuid.UUID, Product]]:
    products = (
        await session.scalars(select(Product).where(Product.active).order_by(Product.position))
    ).all()
    by_id = {p.id: p for p in products}
    derived: dict[uuid.UUID, dict[str, str | None]] = {}
    for student_id, trials in trials_by_student.items():
        derived[student_id] = {
            p.code: derived_size(
                [t.size_label for t in trials if t.product_id == p.id and t.fit == Fit.FITS],
                p.sizes,
            )
            for p in products
        }
    return derived, by_id


async def get_detail(session: AsyncSession, student_id: uuid.UUID) -> StudentDetail:
    """Full student detail including trials and parent choices."""
    student = await _load_student(session, student_id)
    school = await session.get(School, student.school_id)
    school_class = await session.get(SchoolClass, student.class_id)
    assert school is not None and school_class is not None
    trials = await _active_trials(session, student.id)
    products = {p.id: p for p in (await session.scalars(select(Product))).all()}
    derived, _ = await _derived_for(session, {student.id: trials})
    choices = (
        await session.scalars(
            select(ParentSizeChoice)
            .where(ParentSizeChoice.student_id == student.id)
            .order_by(ParentSizeChoice.chosen_at)
        )
    ).all()
    links = await session.execute(
        select(ParentStudentLink, ParentAccount)
        .join(ParentAccount, ParentAccount.id == ParentStudentLink.parent_id)
        .where(ParentStudentLink.student_id == student.id)
        .order_by(ParentStudentLink.created_at, ParentStudentLink.id)
    )
    base = get_settings().public_base_url.rstrip("/")
    return StudentDetail(
        id=student.id,
        full_name=student.full_name,
        dob=student.dob,
        gender=student.gender,
        height_cm=float(student.height_cm),
        weight_kg=float(student.weight_kg),
        parent_name=student.parent_name,
        parent_phone=student.parent_phone,
        parent_email=student.parent_email,
        school=NamedRef(id=school.id, name=school.name),
        class_=ClassRef(id=school_class.id, name=school_class.name, grade=school_class.grade),
        portal_token=student.portal_token,
        portal_url=f"{base}/p/{student.portal_token}",
        data_source=student.data_source,
        measured_at=student.measured_at,
        created_at=student.created_at,
        updated_at=student.updated_at,
        trials=[
            TrialOut(
                id=t.id,
                product_code=products[t.product_id].code,
                product_name=products[t.product_id].name,
                size_label=t.size_label,
                suggested_size_label=t.suggested_size_label,
                fit=t.fit,
                note=t.note,
                tried_at=t.tried_at,
            )
            for t in trials
        ],
        derived_sizes=derived[student.id],
        parent_choices=[
            ParentChoiceOut(
                product_code=products[c.product_id].code,
                product_name=products[c.product_id].name,
                size_label=c.size_label,
                chosen_at=c.chosen_at,
            )
            for c in choices
        ],
        linked_parents=[
            LinkedParentOut(
                parent_id=parent.id,
                full_name=parent.full_name,
                email=parent.email,
                phone=parent.phone,
                origin=link.origin,
                linked_at=link.created_at,
            )
            for link, parent in links
        ],
    )


@dataclass
class ListFilters:
    school_id: uuid.UUID | None = None
    grade: int | None = None
    class_id: uuid.UUID | None = None
    gender: str | None = None
    product: str | None = None
    size: str | None = None
    q: str | None = None
    page: int = 1
    page_size: int = 50


def _fold(text: str) -> str:
    return unicodedata.normalize("NFC", text.strip())


def _search_clauses(q: str) -> list[Any]:
    q = _fold(q)
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    name_match = func.unaccent(func.lower(Student.full_name)).like(
        func.unaccent(func.lower(f"%{escaped}%"))
    )
    clauses = [name_match]
    if re.fullmatch(r"[\d\s+.\-]+", q):
        digits = re.sub(r"\D", "", q)
        if digits.startswith("84") and len(digits) >= 11:
            digits = "0" + digits[2:]
        if len(digits) >= 3:
            clauses.append(Student.parent_phone.like(f"%{digits}%"))
    return clauses


async def list_students(session: AsyncSession, f: ListFilters) -> StudentPage:
    """Filtered, newest-first page. Derived-size filtering happens in Python (<1000 rows)."""
    products = {p.code: p for p in (await session.scalars(select(Product))).all()}
    if f.size is not None:
        if f.product is None:
            raise ApiError(422, "validation_error", "size cần product", {"product": "Bắt buộc"})
        product = products.get(f.product)
        if product is None or (f.size != "none" and f.size not in product.sizes):
            raise ApiError(422, "validation_error", "Bộ lọc không hợp lệ", {"size": "Không hợp lệ"})
    query = (
        select(Student, School, SchoolClass)
        .join(School, School.id == Student.school_id)
        .join(SchoolClass, SchoolClass.id == Student.class_id)
        .where(Student.deleted_at.is_(None))
        .order_by(Student.created_at.desc(), Student.id)
    )
    if f.school_id:
        query = query.where(Student.school_id == f.school_id)
    if f.class_id:
        query = query.where(Student.class_id == f.class_id)
    if f.grade is not None:
        query = query.where(SchoolClass.grade == f.grade)
    if f.gender:
        query = query.where(Student.gender == f.gender)
    if f.q and f.q.strip():
        query = query.where(or_(*_search_clauses(f.q)))
    rows = (await session.execute(query)).all()

    trials_by_student: dict[uuid.UUID, list[FittingTrial]] = {r[0].id: [] for r in rows}
    if rows:
        all_trials = await session.scalars(
            select(FittingTrial).where(
                FittingTrial.student_id.in_(trials_by_student), FittingTrial.deleted_at.is_(None)
            )
        )
        for t in all_trials:
            trials_by_student[t.student_id].append(t)
    derived, _ = await _derived_for(session, trials_by_student)

    if f.size is not None and f.product is not None:
        wanted = None if f.size == "none" else f.size
        rows = [r for r in rows if derived[r[0].id].get(f.product) == wanted]

    total = len(rows)
    start = (f.page - 1) * f.page_size
    items = [
        StudentListItem(
            id=s.id,
            full_name=s.full_name,
            gender=s.gender,
            school=NamedRef(id=sc.id, name=sc.name),
            class_=ClassRef(id=cl.id, name=cl.name, grade=cl.grade),
            height_cm=float(s.height_cm),
            weight_kg=float(s.weight_kg),
            parent_phone=s.parent_phone,
            data_source=s.data_source,
            derived_sizes=derived[s.id],
            trial_count=len(trials_by_student[s.id]),
            has_note=any(t.note for t in trials_by_student[s.id]),
            created_at=s.created_at,
        )
        for s, sc, cl in rows[start : start + f.page_size]
    ]
    return StudentPage(items=items, total=total, page=f.page, page_size=f.page_size)
