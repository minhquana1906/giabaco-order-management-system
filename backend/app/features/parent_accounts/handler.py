"""Parent account use cases."""

import hashlib
import logging
import secrets
import time
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core import audit, email
from app.core.errors import ApiError
from app.core.events import bus
from app.core.names import lock_identity, name_key
from app.core.phone import normalize_phone
from app.core.security import (
    PARENT_SESSION_AT_KEY,
    PARENT_SESSION_KEY,
    hash_password,
    parent_actor,
    verify_password,
)
from app.features.campaigns.models import OPEN, Campaign, campaign_for_student
from app.features.catalog.models import School, SchoolClass
from app.features.orders.models import Order
from app.features.parent_accounts.models import (
    LinkOrigin,
    ParentAccount,
    ParentPasswordReset,
    ParentStudentLink,
)
from app.features.parent_accounts.schemas import (
    ChildIn,
    ChildKeyIn,
    ChildSummary,
    ChildUpdateIn,
    ForgotIn,
    LoginIn,
    LookupOut,
    OrderSummary,
    ParentAccountOut,
    RegisterIn,
    ResetIn,
)
from app.features.students.models import DataSource, Student, student_snapshot

logger = logging.getLogger("app.parent_accounts")

MAX_CHILDREN = 10
_NO_MATCH = (
    "Chưa tìm thấy hồ sơ khớp với thông tin đã nhập. Kiểm tra lại thông tin hoặc liên hệ Giabaco."
)
RESET_TTL = timedelta(minutes=30)
RESET_RESEND_AFTER = timedelta(seconds=60)


def account_out(parent: ParentAccount) -> ParentAccountOut:
    return ParentAccountOut(
        id=parent.id, full_name=parent.full_name, email=parent.email, phone=parent.phone
    )


def _sign_in(request: Request, parent: ParentAccount) -> None:
    request.session[PARENT_SESSION_KEY] = str(parent.id)
    request.session[PARENT_SESSION_AT_KEY] = time.time()


async def load_parent(session: AsyncSession, parent_id: uuid.UUID) -> ParentAccount:
    """The signed-in account; a cookie for a vanished account is unauthorized."""
    parent = await session.get(ParentAccount, parent_id)
    if parent is None:
        raise ApiError(401, "unauthorized", "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.")
    return parent


async def register(session: AsyncSession, request: Request, payload: RegisterIn) -> ParentAccount:
    """Create the account and sign it in."""
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
        raise ApiError(
            409,
            "account_exists",
            "Email hoặc số điện thoại này đã có tài khoản. "
            'Hãy đăng nhập, hoặc bấm "Quên mật khẩu?" nếu bạn quên mật khẩu.',
        ) from None
    await audit.record(
        session, parent_actor(parent.id), "parent_account.register", "parent_account", parent.id,
        None, {"has_phone": parent.phone is not None},
    )  # fmt: skip
    await session.commit()
    logger.info("parent_accounts.registered", extra={"ctx": {"parent_id": str(parent.id)}})
    _sign_in(request, parent)
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
        logger.warning("parent_accounts.login_failed")
        raise ApiError(
            401,
            "invalid_credentials",
            "Email, số điện thoại hoặc mật khẩu chưa đúng. "
            'Kiểm tra lại hoặc bấm "Quên mật khẩu?" để đặt lại.',
        )
    logger.info("parent_accounts.login_succeeded", extra={"ctx": {"parent_id": str(parent.id)}})
    _sign_in(request, parent)
    return parent


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def request_reset(session: AsyncSession, payload: ForgotIn, base_url: str) -> str | None:
    """Make a reset link for the email's account; None if there is none or one was just sent."""
    parent = await session.scalar(select(ParentAccount).where(ParentAccount.email == payload.email))
    if parent is None:
        return None
    now = datetime.now(UTC)
    recent = await session.scalar(
        select(func.count())
        .select_from(ParentPasswordReset)
        .where(
            ParentPasswordReset.parent_id == parent.id,
            ParentPasswordReset.used_at.is_(None),
            ParentPasswordReset.created_at > now - RESET_RESEND_AFTER,
        )
    )
    if recent:
        return None
    await session.execute(
        update(ParentPasswordReset)
        .where(ParentPasswordReset.parent_id == parent.id, ParentPasswordReset.used_at.is_(None))
        .values(used_at=now)
    )
    token = secrets.token_urlsafe(32)
    session.add(
        ParentPasswordReset(
            parent_id=parent.id, token_hash=_token_hash(token), expires_at=now + RESET_TTL
        )
    )
    await audit.record(
        session, "anonymous", "parent_account.reset_requested", "parent_account",
        parent.id, None, None,
    )  # fmt: skip
    await session.commit()
    logger.info("parent_accounts.reset_requested", extra={"ctx": {"parent_id": str(parent.id)}})
    return f"{base_url.rstrip('/')}/parent/reset#token={token}"


async def send_reset_email(to: str, link: str) -> None:
    minutes = int(RESET_TTL.total_seconds() // 60)
    text = (
        "Bạn vừa yêu cầu đặt lại mật khẩu tài khoản G-UNIFORM.\n\n"
        f"Mở liên kết sau để đặt mật khẩu mới (hiệu lực {minutes} phút, dùng một lần):\n"
        f"{link}\n\n"
        "Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn vẫn an toàn."
    )
    html = (
        "<p>Bạn vừa yêu cầu đặt lại mật khẩu tài khoản G-UNIFORM.</p>"
        f'<p><a href="{link}" style="display:inline-block;padding:12px 20px;background:#1B2B4B;'
        'color:#fff;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p>'
        f"<p>Hoặc mở liên kết này: {link}</p>"
        f"<p>Liên kết có hiệu lực {minutes} phút và chỉ dùng một lần.</p>"
        "<p>Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu của bạn vẫn an toàn.</p>"
    )
    await email.send(to, "Đặt lại mật khẩu tài khoản G-UNIFORM", html, text)


async def reset_password(session: AsyncSession, payload: ResetIn) -> None:
    """Spend a reset token, set the new password and invalidate every earlier session."""
    reset = await session.scalar(
        select(ParentPasswordReset)
        .where(ParentPasswordReset.token_hash == _token_hash(payload.token))
        .with_for_update()
    )
    now = datetime.now(UTC)
    if reset is None or reset.used_at is not None or reset.expires_at <= now:
        raise ApiError(
            400,
            "invalid_reset_token",
            "Liên kết đặt lại mật khẩu đã hết hạn (sau 30 phút) hoặc đã được dùng. "
            "Hãy yêu cầu liên kết mới.",
        )
    parent = await session.get(ParentAccount, reset.parent_id)
    assert parent is not None  # parent_id is ON DELETE CASCADE
    parent.password_hash = await run_in_threadpool(hash_password, payload.password)
    parent.password_changed_at = now
    reset.used_at = now
    await audit.record(
        session, parent_actor(parent.id), "parent_account.password_reset", "parent_account",
        parent.id, None, None,
    )  # fmt: skip
    await session.commit()
    logger.info("parent_accounts.reset_completed", extra={"ctx": {"parent_id": str(parent.id)}})


async def children(
    session: AsyncSession, parent_id: uuid.UUID, student_id: uuid.UUID | None = None
) -> list[ChildSummary]:
    """Linked, live students of one parent with their current order summary."""
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
    summaries: dict[uuid.UUID, OrderSummary] = {}
    for student, _, _ in rows:
        campaign = await campaign_for_student(session, student.school_id, student.id)
        order = (
            await session.scalar(
                select(Order).where(
                    Order.campaign_id == campaign.id,
                    Order.student_id == student.id,
                    Order.deleted_at.is_(None),
                )
            )
            if campaign
            else None
        )
        if order is not None:
            items, amount, has_unpriced = order.totals
            summaries[student.id] = OrderSummary(
                items=items, amount=amount, has_unpriced=has_unpriced, status=order.status
            )
    open_schools = set(
        (
            await session.scalars(
                select(Campaign.school_id).where(
                    Campaign.status == OPEN,
                    Campaign.school_id.in_({s.school_id for s, _, _ in rows}),
                )
            )
        ).all()
    )
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
            order_summary=summaries.get(s.id),
            campaign_open=s.school_id in open_schools,
        )
        for s, school_name, class_name in rows
    ]


async def child(session: AsyncSession, parent_id: uuid.UUID, student_id: uuid.UUID) -> ChildSummary:
    """One linked child; a student gone since the request began reads as not found."""
    found = await children(session, parent_id, student_id)
    if not found:
        raise ApiError(
            404,
            "not_found",
            _NO_MATCH,
        )
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
        raise ApiError(
            404,
            "no_match",
            _NO_MATCH,
        )
    if len(matches) > 1:
        logger.warning(
            "parent_accounts.claim_ambiguous",
            extra={"ctx": {"school_id": str(key.school_id), "matches_at_least": len(matches)}},
        )
        raise ApiError(
            409,
            "ambiguous_match",
            "Có nhiều hồ sơ trùng thông tin này. Vui lòng liên hệ Giabaco để được xác nhận.",
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
        logger.info(
            "parent_accounts.child_linked",
            extra={"ctx": {"parent_id": str(parent.id), "student_id": str(student.id)}},
        )
        bus.publish("students")
    return await child(session, parent.id, student.id)


async def list_schools(session: AsyncSession) -> Sequence[School]:
    return (await session.scalars(select(School).order_by(School.name))).all()


async def list_classes(session: AsyncSession, school_id: uuid.UUID) -> Sequence[SchoolClass]:
    if await session.get(School, school_id) is None:
        raise ApiError(404, "not_found", "Trường này không còn trong hệ thống. Tải lại trang.")
    result = await session.scalars(
        select(SchoolClass)
        .where(SchoolClass.school_id == school_id)
        .order_by(SchoolClass.grade, func.length(SchoolClass.name), SchoolClass.name)
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
            "Lớp này không thuộc trường đã chọn. Vui lòng chọn lại lớp.",
            {"class_id": "Lớp này không thuộc trường đã chọn. Vui lòng chọn lại lớp."},
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
            409,
            "child_exists",
            "Hồ sơ của con đã có trong hệ thống. "
            'Dùng "Tìm hồ sơ" để nhận hồ sơ về tài khoản của bạn.',
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
            f"Tài khoản đã đủ {MAX_CHILDREN} hồ sơ con. Nếu cần thêm, vui lòng liên hệ Giabaco.",
        )
    student = Student(
        school_id=payload.school_id,
        class_id=payload.class_id,
        full_name=payload.full_name,
        dob=payload.dob,
        gender=payload.gender,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        parent_name=parent.full_name,
        parent_phone=parent.phone,
        parent_email=parent.email,
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
    logger.info(
        "parent_accounts.child_created",
        extra={"ctx": {"parent_id": str(parent.id), "student_id": str(student.id)}},
    )
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
        raise ApiError(
            404,
            "not_found",
            "Hồ sơ này không còn trong tài khoản của bạn. Hãy quay lại danh sách hồ sơ.",
        )
    if student.data_source is not DataSource.PARENT_DECLARED:
        raise ApiError(
            409,
            "measured_locked",
            "Giabaco đã đo hồ sơ này nên bạn không sửa được. "
            "Nếu cần thay đổi, vui lòng liên hệ Giabaco.",
        )
    await check_class(session, student.school_id, payload.class_id)
    before = student_snapshot(student)
    student.class_id = payload.class_id
    student.gender = payload.gender
    student.height_cm = payload.height_cm
    student.weight_kg = payload.weight_kg
    student.parent_name = parent.full_name
    student.parent_phone = parent.phone
    student.parent_email = parent.email
    student.measured_at = datetime.now(UTC)
    await session.flush()
    await audit.record(
        session, parent_actor(parent.id), "student.update", "student", student.id, before,
        student_snapshot(student),
    )  # fmt: skip
    await session.commit()
    logger.info(
        "parent_accounts.child_updated",
        extra={"ctx": {"parent_id": str(parent.id), "student_id": str(student.id)}},
    )
    bus.publish("students")
    return await child(session, parent.id, student.id)


async def unlink(
    session: AsyncSession, student_id: uuid.UUID, parent_id: uuid.UUID, actor: str
) -> None:
    """Admin removes a parent's link; orders already placed stay."""
    link = await session.scalar(
        select(ParentStudentLink).where(
            ParentStudentLink.student_id == student_id, ParentStudentLink.parent_id == parent_id
        )
    )
    if link is None:
        raise ApiError(404, "not_found", "Liên kết này đã được gỡ trước đó. Tải lại trang.")
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
    logger.info(
        "parent_accounts.child_unlinked",
        extra={"ctx": {"parent_id": str(parent_id), "student_id": str(student_id)}},
    )
    bus.publish("students")
