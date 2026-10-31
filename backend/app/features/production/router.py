"""Production API, isolated from the admin session for facility users."""

import logging
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, date, datetime
from typing import Annotated, Any, TypedDict

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.audit import AuditLog, record
from app.core.db import get_session
from app.core.errors import ApiError
from app.core.order_pivot import submitted_orders
from app.core.security import (
    SESSION_EXPIRED_MESSAGE,
    SESSION_KEY,
    hash_password,
    limit_login,
    require_admin,
    verify_password,
)
from app.features.campaigns.models import (
    Campaign,
    CampaignItem,
    CampaignKit,
    KitSlot,
    KitSlotOption,
)
from app.features.catalog.models import Product
from app.features.master_data.models import Facility
from app.features.orders.models import Order, OrderLine
from app.features.production.models import Assignment, CampaignStep, FacilityStaff
from app.features.production.schemas import (
    ActivityOut,
    AssignmentIn,
    AssignmentOut,
    AssignmentUpdate,
    DemandOut,
    FacilityOut,
    HistoryOut,
    Login,
    ProgressCampaign,
    ProgressOut,
    ProgressStep,
    ProgressUpdate,
    StaffIn,
    StaffOut,
    StaffUpdate,
    StepModeIn,
    StepOut,
    TimelineIn,
)

router = APIRouter(prefix="/api/production", tags=["production"])
Session = Annotated[AsyncSession, Depends(get_session)]
FACILITY_SESSION = "production_staff"
logger = logging.getLogger("app.production")
DEFAULT_NAMES = [
    "Khảo sát nhu cầu",
    "Duyệt mẫu",
    "Dự báo nguyên phụ liệu",
    "Thu và khóa cỡ",
    "Lập kế hoạch năng lực",
    "Sản xuất",
    "Kiểm tra chất lượng",
    "Đóng gói",
    "Giao hàng và đối soát",
    "Đổi trả",
]


class Who(TypedDict):
    role: str
    facility_id: uuid.UUID | None
    actor: str


def missing(what: str = "phân công") -> ApiError:
    return ApiError(404, "not_found", f"Không tìm thấy {what} này. Tải lại trang.")


async def identity(request: Request, session: Session) -> Who:
    if request.session.get(SESSION_KEY):
        try:
            return {"role": "admin", "facility_id": None, "actor": await require_admin(request)}
        except ApiError:
            pass
    data = request.session.get(FACILITY_SESSION)
    if isinstance(data, dict):
        try:
            staff_id: uuid.UUID | None = uuid.UUID(data.get("id", ""))
        except (ValueError, TypeError, AttributeError):
            staff_id = None
        staff = await session.get(FacilityStaff, staff_id) if staff_id else None
        facility = await session.get(Facility, staff.facility_id) if staff else None
        if (
            staff
            and staff.disabled_at is None
            and facility
            and facility.active
            and data.get("version") == staff.session_version
        ):
            return {
                "role": "facility",
                "facility_id": staff.facility_id,
                "actor": f"production_staff:{staff.id}",
            }
    raise ApiError(401, "unauthorized", SESSION_EXPIRED_MESSAGE)


Identity = Annotated[Who, Depends(identity)]


def admin(who: Who) -> None:
    if who["role"] != "admin":
        logger.warning("production.forbidden", extra={"ctx": {"role": who["role"]}})
        raise ApiError(403, "forbidden", "Tài khoản này không có quyền thực hiện thao tác này.")


async def get_facility(
    session: AsyncSession, facility_id: uuid.UUID, active: bool = False
) -> Facility:
    facility = await session.get(Facility, facility_id)
    if not facility:
        raise missing("đối tác")
    if active and not facility.active:
        raise ApiError(
            409,
            "facility_inactive",
            "Đối tác đang tạm dừng hoặc ngừng hợp tác nên chưa nhận được phân công mới. "
            "Chọn đối tác khác.",
        )
    return facility


async def get_assignment(
    session: AsyncSession, assignment_id: uuid.UUID, who: Who, lock: bool = False
) -> Assignment:
    query = select(Assignment).where(Assignment.id == assignment_id)
    if who["role"] == "facility":
        query = query.where(Assignment.facility_id == who["facility_id"])
    if lock:
        query = query.with_for_update()
    assignment = await session.scalar(query)
    if not assignment:
        raise missing()
    return assignment


def snapshot(row: Assignment) -> dict[str, Any]:
    return {
        "campaign_id": str(row.campaign_id),
        "step_position": row.step_position,
        "facility_id": str(row.facility_id) if row.facility_id else None,
        "assignee": row.assignee,
        "product_id": str(row.product_id) if row.product_id else None,
        "quantity": row.quantity,
        "deadline": row.deadline.isoformat() if row.deadline else None,
        "status": row.status,
        "content": row.content,
        "actual_at": row.actual_at.isoformat() if row.actual_at else None,
    }


PROGRESS_KEYS = ("status", "content", "actual_at", "deadline")
PROGRESS_FIELDS = ("status", "content", "actual_at")


def integrity_conflict(exc: IntegrityError) -> ApiError:
    """Map unique and foreign-key violations to polite 409s; anything else is a real bug."""
    orig: Any = exc.orig
    if getattr(orig, "sqlstate", None) == "23505" or (
        getattr(getattr(orig, "diag", None), "constraint_name", None)
        == "uq_production_assignments_scope"
    ):
        return ApiError(
            409,
            "conflict",
            "Phân công này đã có cho cùng bước, đối tác và sản phẩm. Hãy sửa phân công hiện có.",
        )
    if getattr(orig, "sqlstate", None) == "23503":
        return ApiError(
            409,
            "conflict",
            "Đợt, sản phẩm hoặc đối tác này không còn tồn tại. Tải lại trang.",
        )
    raise exc


async def record_progress(
    session: AsyncSession,
    actor: str,
    assignment_id: uuid.UUID,
    before: dict[str, Any],
    after: dict[str, Any],
) -> None:
    await record(
        session,
        actor,
        "update_progress",
        "production_assignment",
        assignment_id,
        {k: before[k] for k in PROGRESS_KEYS},
        {k: after[k] for k in PROGRESS_KEYS},
    )


async def check_product(
    session: AsyncSession, campaign_id: uuid.UUID, product_id: uuid.UUID
) -> None:
    item = await session.scalar(
        select(CampaignItem.id).where(
            CampaignItem.campaign_id == campaign_id, CampaignItem.product_id == product_id
        )
    )
    kit = await session.scalar(
        select(KitSlotOption.id)
        .join(KitSlot, KitSlot.id == KitSlotOption.slot_id)
        .join(CampaignKit, CampaignKit.id == KitSlot.kit_id)
        .where(CampaignKit.campaign_id == campaign_id, KitSlotOption.product_id == product_id)
    )
    if not item and not kit:
        raise ApiError(
            422, "validation_error", "Sản phẩm này không có trong đợt đã chọn. Chọn lại sản phẩm."
        )


async def timeline(session: AsyncSession, campaign_id: uuid.UUID) -> list[StepOut]:
    if not await session.get(Campaign, campaign_id):
        raise missing("đợt")
    rows = (
        await session.scalars(select(CampaignStep).where(CampaignStep.campaign_id == campaign_id))
    ).all()
    by_position = {row.position: row for row in rows}
    return [
        StepOut(
            position=i,
            name=by_position[i].name if i in by_position else DEFAULT_NAMES[i - 1],
            deadline=by_position[i].deadline if i in by_position else None,
            mode="internal"
            if i in by_position and by_position[i].mode == "internal"
            else "partners",
        )
        for i in range(1, 11)
    ]


async def step_mode(session: AsyncSession, campaign_id: uuid.UUID, position: int) -> str:
    mode = await session.scalar(
        select(CampaignStep.mode).where(
            CampaignStep.campaign_id == campaign_id, CampaignStep.position == position
        )
    )
    return mode or "partners"


def invalid(message: str) -> ApiError:
    return ApiError(422, "validation_error", message)


async def lock_campaign(session: AsyncSession, campaign_id: uuid.UUID) -> None:
    if not await session.scalar(
        select(Campaign.id).where(Campaign.id == campaign_id).with_for_update()
    ):
        raise missing("đợt")


async def render(session: AsyncSession, rows: Sequence[Assignment]) -> list[AssignmentOut]:
    if not rows:
        return []
    campaigns = {
        c.id: c
        for c in await session.scalars(
            select(Campaign).where(Campaign.id.in_({r.campaign_id for r in rows}))
        )
    }
    facilities = {
        f.id: f
        for f in await session.scalars(
            select(Facility).where(Facility.id.in_({r.facility_id for r in rows if r.facility_id}))
        )
    }
    product_ids = {r.product_id for r in rows if r.product_id}
    products = {
        p.id: p for p in await session.scalars(select(Product).where(Product.id.in_(product_ids)))
    }
    stored: dict[uuid.UUID, dict[int, CampaignStep]] = defaultdict(dict)
    for saved in await session.scalars(
        select(CampaignStep).where(CampaignStep.campaign_id.in_(list(campaigns)))
    ):
        stored[saved.campaign_id][saved.position] = saved
    history: dict[uuid.UUID, list[HistoryOut]] = defaultdict(list)
    events = await session.scalars(
        select(AuditLog)
        .where(
            AuditLog.entity == "production_assignment",
            AuditLog.entity_id.in_([r.id for r in rows]),
            AuditLog.action == "update_progress",
        )
        .order_by(AuditLog.at, AuditLog.id)
    )
    for event in events:
        after = event.after or {}
        history[event.entity_id].append(
            HistoryOut(
                id=event.id,
                at=event.at,
                actor=event.actor,
                status=after["status"],
                content=after.get("content"),
                actual_at=after.get("actual_at"),
                deadline=after.get("deadline"),
            )
        )
    today = date.today()
    rendered: list[AssignmentOut] = []
    for row in rows:
        step = stored[row.campaign_id].get(row.step_position)
        step_name = step.name if step else DEFAULT_NAMES[row.step_position - 1]
        step_deadline = step.deadline if step else None
        facility = facilities.get(row.facility_id) if row.facility_id else None
        effective = row.deadline or step_deadline
        product = products.get(row.product_id) if row.product_id else None
        rendered.append(
            AssignmentOut(
                id=row.id,
                campaign_id=row.campaign_id,
                campaign_name=campaigns[row.campaign_id].name,
                step_position=row.step_position,
                step_name=step_name,
                step_mode="internal" if step and step.mode == "internal" else "partners",
                facility_id=row.facility_id,
                facility_name=facility.name if facility else None,
                assignee=row.assignee,
                product_id=row.product_id,
                product_name=product.name if product else None,
                quantity=row.quantity,
                deadline=row.deadline,
                step_deadline=step_deadline,
                effective_deadline=effective,
                overdue=bool(effective and effective < today and row.status != "completed"),
                status=row.status,
                content=row.content,
                actual_at=row.actual_at,
                history=history[row.id],
            )
        )
    return rendered


@router.post("/login", dependencies=[Depends(limit_login)])
async def login(payload: Login, request: Request, session: Session) -> dict[str, Any]:
    staff = await session.scalar(
        select(FacilityStaff).where(FacilityStaff.username == payload.username.lower())
    )
    valid = await run_in_threadpool(
        verify_password, staff.password_hash if staff else None, payload.password
    )
    facility = await session.get(Facility, staff.facility_id) if staff else None
    if (
        not valid
        or not staff
        or staff.disabled_at is not None
        or not facility
        or not facility.active
    ):
        raise ApiError(
            401,
            "invalid_credentials",
            "Tên đăng nhập hoặc mật khẩu chưa đúng. Kiểm tra lại rồi thử lại.",
        )
    request.session.pop(SESSION_KEY, None)
    request.session[FACILITY_SESSION] = {"id": str(staff.id), "version": staff.session_version}
    return {"role": "facility", "facility_id": staff.facility_id}


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    request.session.pop(FACILITY_SESSION, None)
    return Response(status_code=204)


@router.get("/me")
async def me(who: Identity) -> dict[str, Any]:
    return {"role": who["role"], "facility_id": who["facility_id"]}


@router.get("/facilities", response_model=list[FacilityOut])
async def list_facilities(session: Session, who: Identity) -> list[FacilityOut]:
    """Facilities are edited in master data; this list feeds assignments."""
    admin(who)
    return [
        FacilityOut(
            id=f.id,
            code=f.code,
            name=f.name,
            active=f.active,
            main_stage=str(f.data.get("Công đoạn chính") or "").strip() or None,
        )
        for f in await session.scalars(select(Facility).order_by(Facility.code))
    ]


@router.get("/facilities/{facility_id}/staff", response_model=list[StaffOut])
async def list_staff(
    facility_id: uuid.UUID, session: Session, who: Identity
) -> Sequence[FacilityStaff]:
    admin(who)
    await get_facility(session, facility_id)
    return (
        await session.scalars(
            select(FacilityStaff)
            .where(FacilityStaff.facility_id == facility_id)
            .order_by(FacilityStaff.username)
        )
    ).all()


@router.post("/facilities/{facility_id}/staff", response_model=StaffOut, status_code=201)
async def create_staff(
    facility_id: uuid.UUID, payload: StaffIn, session: Session, who: Identity
) -> FacilityStaff:
    admin(who)
    await get_facility(session, facility_id, True)
    staff = FacilityStaff(
        facility_id=facility_id,
        username=payload.username,
        password_hash=await run_in_threadpool(hash_password, payload.password),
    )
    session.add(staff)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "conflict", "Tên đăng nhập này đã được dùng. Chọn tên khác.") from None
    await record(
        session,
        who["actor"],
        "create",
        "production_staff",
        staff.id,
        None,
        {"facility_id": str(facility_id), "username": staff.username},
    )
    await session.commit()
    logger.info(
        "production.staff_created",
        extra={"ctx": {"staff_id": str(staff.id), "facility_id": str(facility_id)}},
    )
    return staff


@router.patch("/facilities/{facility_id}/staff/{staff_id}", response_model=StaffOut)
async def update_staff(
    facility_id: uuid.UUID,
    staff_id: uuid.UUID,
    payload: StaffUpdate,
    session: Session,
    who: Identity,
) -> FacilityStaff:
    admin(who)
    staff = await session.scalar(
        select(FacilityStaff)
        .where(FacilityStaff.id == staff_id, FacilityStaff.facility_id == facility_id)
        .with_for_update()
    )
    if not staff:
        raise missing("tài khoản")
    before = {"username": staff.username, "disabled": staff.disabled_at is not None}
    if payload.username is not None and payload.username != staff.username:
        staff.username = payload.username
        staff.session_version += 1
    if payload.password is not None:
        staff.password_hash = await run_in_threadpool(hash_password, payload.password)
        staff.session_version += 1
    if payload.disabled is not None:
        staff.disabled_at = datetime.now(UTC) if payload.disabled else None
        staff.session_version += 1
    await record(
        session,
        who["actor"],
        "update",
        "production_staff",
        staff.id,
        before,
        {
            "username": staff.username,
            "disabled": staff.disabled_at is not None,
            "password_changed": payload.password is not None,
        },
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "conflict", "Tên đăng nhập này đã được dùng. Chọn tên khác.") from None
    if payload.disabled is not None:
        logger.info(
            "production.staff_disabled" if payload.disabled else "production.staff_enabled",
            extra={"ctx": {"staff_id": str(staff.id), "facility_id": str(facility_id)}},
        )
    return staff


@router.get("/campaigns/{campaign_id}/timeline")
async def get_timeline(
    campaign_id: uuid.UUID, session: Session, who: Identity
) -> dict[str, list[StepOut]]:
    admin(who)
    return {"steps": await timeline(session, campaign_id)}


@router.put("/campaigns/{campaign_id}/timeline")
async def put_timeline(
    campaign_id: uuid.UUID, payload: TimelineIn, session: Session, who: Identity
) -> dict[str, list[StepOut]]:
    admin(who)
    campaign = await session.scalar(
        select(Campaign).where(Campaign.id == campaign_id).with_for_update()
    )
    if not campaign:
        raise missing("đợt")
    before = [step.model_dump(mode="json") for step in await timeline(session, campaign_id)]
    existing = {
        row.position: row
        for row in (
            await session.scalars(
                select(CampaignStep).where(CampaignStep.campaign_id == campaign_id)
            )
        ).all()
    }
    for step in payload.steps:
        row = existing.get(step.position)
        if row is None:
            row = CampaignStep(campaign_id=campaign_id, position=step.position)
            session.add(row)
        row.name, row.deadline = step.name, step.deadline
    await record(
        session,
        who["actor"],
        "update",
        "production_timeline",
        campaign_id,
        {"steps": before},
        {"steps": [step.model_dump(mode="json") for step in payload.steps]},
    )
    await session.commit()
    return {"steps": await timeline(session, campaign_id)}


@router.patch("/campaigns/{campaign_id}/steps/{position}", response_model=StepOut)
async def set_step_mode(
    campaign_id: uuid.UUID, position: int, payload: StepModeIn, session: Session, who: Identity
) -> StepOut:
    admin(who)
    if not 1 <= position <= 10:
        raise missing("bước")
    await lock_campaign(session, campaign_id)
    row = await session.scalar(
        select(CampaignStep).where(
            CampaignStep.campaign_id == campaign_id, CampaignStep.position == position
        )
    )
    if row is None:
        row = CampaignStep(
            campaign_id=campaign_id, position=position, name=DEFAULT_NAMES[position - 1]
        )
        session.add(row)
    before_mode = row.mode or "partners"
    foreign = (
        select(func.count())
        .select_from(Assignment)
        .where(
            Assignment.campaign_id == campaign_id,
            Assignment.step_position == position,
            Assignment.facility_id.is_(None)
            if payload.mode == "partners"
            else Assignment.facility_id.is_not(None),
        )
    )
    if await session.scalar(foreign):
        raise ApiError(
            409,
            "conflict",
            "Bước này đang có phân công. Hủy các phân công trước khi đổi cách thực hiện.",
        )
    row.mode = payload.mode
    await record(
        session,
        who["actor"],
        "update",
        "production_timeline",
        campaign_id,
        {"position": position, "mode": before_mode},
        {"position": position, "mode": payload.mode},
    )
    await session.commit()
    logger.info(
        "production.step_mode_updated",
        extra={"ctx": {"campaign_id": str(campaign_id), "step": position, "mode": payload.mode}},
    )
    return next(step for step in await timeline(session, campaign_id) if step.position == position)


@router.get("/campaigns/{campaign_id}/progress", response_model=ProgressOut)
async def campaign_progress(campaign_id: uuid.UUID, session: Session, who: Identity) -> ProgressOut:
    admin(who)
    campaign = await session.get(Campaign, campaign_id)
    if not campaign:
        raise missing("đợt")
    steps = await timeline(session, campaign_id)
    rows = (
        await session.scalars(
            select(Assignment)
            .outerjoin(Product, Product.id == Assignment.product_id)
            .where(Assignment.campaign_id == campaign_id)
            .order_by(Assignment.step_position, Product.name.nulls_first(), Assignment.id)
        )
    ).all()
    by_step: dict[int, list[AssignmentOut]] = defaultdict(list)
    for out in await render(session, rows):
        by_step[out.step_position].append(out)
    in_campaign = (
        select(CampaignItem.product_id)
        .where(CampaignItem.campaign_id == campaign_id)
        .union(
            select(KitSlotOption.product_id)
            .join(KitSlot, KitSlot.id == KitSlotOption.slot_id)
            .join(CampaignKit, CampaignKit.id == KitSlot.kit_id)
            .where(CampaignKit.campaign_id == campaign_id)
        )
    )
    ordered = (
        select(OrderLine.product_id, func.sum(OrderLine.qty).label("qty"))
        .where(OrderLine.order_id.in_(submitted_orders(campaign_id).with_only_columns(Order.id)))
        .group_by(OrderLine.product_id)
        .subquery()
    )
    demand = (
        await session.execute(
            select(Product.id, Product.name, func.coalesce(ordered.c.qty, 0))
            .outerjoin(ordered, ordered.c.product_id == Product.id)
            .where(Product.id.in_(in_campaign))
            .order_by(Product.name, Product.id)
        )
    ).all()
    submitted = await session.scalar(
        select(func.count()).select_from(submitted_orders(campaign_id).subquery())
    )
    return ProgressOut(
        campaign=ProgressCampaign(
            id=campaign.id,
            name=campaign.name,
            status=campaign.status,
            closes_at=campaign.closes_at,
            submitted_orders=submitted or 0,
        ),
        steps=[
            ProgressStep(
                position=step.position,
                name=step.name,
                deadline=step.deadline,
                mode=step.mode,
                state=(
                    "unassigned"
                    if not by_step[step.position]
                    else "completed"
                    if all(a.status == "completed" for a in by_step[step.position])
                    else "in_progress"
                ),
                overdue=any(a.overdue for a in by_step[step.position]),
                assignments=by_step[step.position],
            )
            for step in steps
        ],
        demand=[
            DemandOut(product_id=pid, product_name=name, ordered_qty=int(qty))
            for pid, name, qty in demand
        ],
    )


@router.get("/assignments", response_model=list[AssignmentOut])
async def list_assignments(
    session: Session,
    who: Identity,
    campaign_id: uuid.UUID | None = None,
    facility_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AssignmentOut]:
    if not 1 <= limit <= 500 or offset < 0:
        logger.warning(
            "production.invalid_pagination", extra={"ctx": {"limit": limit, "offset": offset}}
        )
        raise ApiError(
            422, "validation_error", "Yêu cầu tải danh sách không hợp lệ. Tải lại trang."
        )
    query = (
        select(Assignment)
        .join(Campaign, Campaign.id == Assignment.campaign_id)
        .outerjoin(Product, Product.id == Assignment.product_id)
        .order_by(
            Campaign.created_at,
            Assignment.campaign_id,
            Assignment.step_position,
            Product.name.nulls_first(),
            Assignment.id,
        )
        .limit(limit)
        .offset(offset)
    )
    if who["role"] == "facility":
        facility_id = who["facility_id"]
    if campaign_id:
        query = query.where(Assignment.campaign_id == campaign_id)
    if facility_id:
        query = query.where(Assignment.facility_id == facility_id)
    return await render(session, (await session.scalars(query)).all())


@router.post("/assignments", response_model=AssignmentOut, status_code=201)
async def create_assignment(
    payload: AssignmentIn, session: Session, who: Identity
) -> AssignmentOut:
    admin(who)
    await lock_campaign(session, payload.campaign_id)
    mode = await step_mode(session, payload.campaign_id, payload.step_position)
    if mode == "internal":
        if payload.facility_id or payload.product_id or payload.quantity:
            raise invalid(
                "Bước nội bộ không có đối tác, sản phẩm hay số lượng. Bỏ các thông tin này."
            )
        if await session.scalar(
            select(Assignment.id).where(
                Assignment.campaign_id == payload.campaign_id,
                Assignment.step_position == payload.step_position,
            )
        ):
            raise ApiError(
                409,
                "conflict",
                "Bước nội bộ chỉ có một bản ghi. Hãy sửa bản ghi hiện có.",
            )
    else:
        if not payload.facility_id:
            raise invalid("Chọn đối tác cho phân công này.")
        if payload.assignee:
            raise invalid("Người phụ trách chỉ áp dụng cho bước nội bộ. Bỏ thông tin này.")
        await get_facility(session, payload.facility_id, True)
    if payload.product_id:
        await check_product(session, payload.campaign_id, payload.product_id)
    row = Assignment(**payload.model_dump())
    session.add(row)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise integrity_conflict(exc) from None
    await record(
        session, who["actor"], "create", "production_assignment", row.id, None, snapshot(row)
    )
    await session.commit()
    logger.info("production.assignment_created", extra={"ctx": {"assignment_id": str(row.id)}})
    return (await render(session, [row]))[0]


@router.patch("/assignments/{assignment_id}", response_model=AssignmentOut)
async def update_assignment(
    assignment_id: uuid.UUID, payload: AssignmentUpdate, session: Session, who: Identity
) -> AssignmentOut:
    admin(who)
    row = await get_assignment(session, assignment_id, who, True)
    before = snapshot(row)
    internal = await step_mode(session, row.campaign_id, row.step_position) == "internal"
    for key in payload.model_fields_set:
        value = getattr(payload, key)
        if internal and key in ("facility_id", "product_id", "quantity"):
            if value is not None:
                raise invalid(
                    "Bước nội bộ không có đối tác, sản phẩm hay số lượng. Bỏ các thông tin này."
                )
            continue
        if not internal and key == "assignee":
            if value is not None:
                raise invalid("Người phụ trách chỉ áp dụng cho bước nội bộ. Bỏ thông tin này.")
            continue
        if key in ("facility_id", "status") and value is None:
            raise ApiError(422, "validation_error", "Thông tin này không được để trống.")
        if key == "facility_id" and value != row.facility_id:
            await get_facility(session, value, True)
        if key == "product_id" and value and value != row.product_id:
            await check_product(session, row.campaign_id, value)
        setattr(row, key, value)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise integrity_conflict(exc) from None
    after = snapshot(row)
    if any(before[k] != after[k] for k in before if k not in PROGRESS_FIELDS):
        await record(
            session, who["actor"], "update", "production_assignment", row.id, before, after
        )
    if any(before[k] != after[k] for k in PROGRESS_FIELDS):
        await record_progress(session, who["actor"], row.id, before, after)
    await session.commit()
    logger.info(
        "production.assignment_updated",
        extra={"ctx": {"assignment_id": str(row.id), "fields": sorted(payload.model_fields_set)}},
    )
    return (await render(session, [row]))[0]


@router.put("/assignments/{assignment_id}/progress", response_model=AssignmentOut)
async def update_progress(
    assignment_id: uuid.UUID, payload: ProgressUpdate, session: Session, who: Identity
) -> AssignmentOut:
    row = await get_assignment(session, assignment_id, who, True)
    before = snapshot(row)
    row.status = payload.status
    if "content" in payload.model_fields_set:
        row.content = payload.content
    if "actual_at" in payload.model_fields_set:
        row.actual_at = payload.actual_at
    after = snapshot(row)
    if before == after:
        return (await render(session, [row]))[0]
    await record_progress(session, who["actor"], row.id, before, after)
    await session.commit()
    logger.info(
        "production.progress_updated",
        extra={"ctx": {"assignment_id": str(row.id), "status": row.status}},
    )
    return (await render(session, [row]))[0]


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: uuid.UUID, session: Session, who: Identity) -> Response:
    admin(who)
    row = await get_assignment(session, assignment_id, who, True)
    await record(
        session, who["actor"], "delete", "production_assignment", row.id, snapshot(row), None
    )
    await session.delete(row)
    await session.commit()
    logger.info("production.assignment_deleted", extra={"ctx": {"assignment_id": str(row.id)}})
    return Response(status_code=204)


@router.get("/assignments/{assignment_id}/audit")
async def assignment_audit(
    assignment_id: uuid.UUID, session: Session, who: Identity
) -> list[dict[str, Any]]:
    await get_assignment(session, assignment_id, who)
    query = select(AuditLog).where(
        AuditLog.entity == "production_assignment", AuditLog.entity_id == assignment_id
    )
    if who["role"] == "facility":
        query = query.where(AuditLog.action == "update_progress")
    rows = (await session.scalars(query.order_by(AuditLog.at, AuditLog.id))).all()
    return [
        {
            "id": row.id,
            "at": row.at,
            "actor": row.actor,
            "action": row.action,
            "before": row.before,
            "after": row.after,
        }
        for row in rows
    ]


@router.get("/campaigns/{campaign_id}/activity", response_model=list[ActivityOut])
async def campaign_activity(
    campaign_id: uuid.UUID, session: Session, who: Identity, limit: int = 50
) -> list[ActivityOut]:
    admin(who)
    if not 1 <= limit <= 200:
        raise invalid("Yêu cầu tải danh sách không hợp lệ. Tải lại trang.")
    if not await session.get(Campaign, campaign_id):
        raise missing("đợt")
    cid = str(campaign_id)
    scoped = select(AuditLog.entity_id).where(
        AuditLog.entity == "production_assignment",
        (AuditLog.after["campaign_id"].astext == cid)
        | (AuditLog.before["campaign_id"].astext == cid),
    )
    events = (
        await session.scalars(
            select(AuditLog)
            .where(
                ((AuditLog.entity == "production_assignment") & AuditLog.entity_id.in_(scoped))
                | (
                    (AuditLog.entity == "production_timeline")
                    & (AuditLog.entity_id == campaign_id)
                    & AuditLog.after["mode"].is_not(None)
                )
            )
            .order_by(AuditLog.at, AuditLog.id)
        )
    ).all()
    last: dict[uuid.UUID, dict[str, Any]] = {}
    for event in events:
        snap = event.after or event.before or {}
        if event.entity == "production_assignment" and "campaign_id" in snap:
            last[event.entity_id] = snap
    names = {
        step.position: step.name
        for step in await session.scalars(
            select(CampaignStep).where(CampaignStep.campaign_id == campaign_id)
        )
    }
    facility_ids = {uuid.UUID(s["facility_id"]) for s in last.values() if s.get("facility_id")}
    product_ids = {uuid.UUID(s["product_id"]) for s in last.values() if s.get("product_id")}
    facilities = {
        f.id: f.name
        for f in await session.scalars(select(Facility).where(Facility.id.in_(facility_ids)))
    }
    products = {
        p.id: p.name
        for p in await session.scalars(select(Product).where(Product.id.in_(product_ids)))
    }
    out: list[ActivityOut] = []
    for event in reversed(events):
        after = event.after or {}
        if event.entity == "production_timeline":
            position = after["position"]
            out.append(
                ActivityOut(
                    id=event.id,
                    at=event.at,
                    actor=event.actor,
                    action="mode",
                    step_position=position,
                    step_name=names.get(position, DEFAULT_NAMES[position - 1]),
                    partner=None,
                    product_name=None,
                    status=None,
                    note="Nội bộ" if after["mode"] == "internal" else "Giao đối tác",
                )
            )
            continue
        snap = last.get(event.entity_id, {})
        position = snap.get("step_position")
        facility_id = snap.get("facility_id")
        product_id = snap.get("product_id")
        status = (event.after or event.before or {}).get("status")
        out.append(
            ActivityOut(
                id=event.id,
                at=event.at,
                actor=event.actor,
                action=event.action,
                step_position=position,
                step_name=names.get(position, DEFAULT_NAMES[position - 1]) if position else "",
                partner=(facilities.get(uuid.UUID(facility_id)) if facility_id else None)
                or snap.get("assignee"),
                product_name=products.get(uuid.UUID(product_id)) if product_id else None,
                status=status,
                note=after.get("content") if event.action == "update_progress" else None,
            )
        )
    return out[:limit]
