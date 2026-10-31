"""Admin master data: list, create, update and delete records."""

import logging
import uuid
from collections import defaultdict
from typing import Annotated, Any, Literal, cast

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.db import get_session
from app.core.errors import ApiError
from app.core.security import require_admin
from app.features.catalog.models import Product
from app.features.master_data.fields import CONDITIONAL_REQUIRED, FIELDS, REQUIRED, missing_fields
from app.features.master_data.models import Facility, MasterRecord

Kind = Literal["facilities", "materials", "suppliers", "products"]
Record = MasterRecord | Facility
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[str, Depends(require_admin)]
router = APIRouter(prefix="/api/master-data", dependencies=[Depends(require_admin)])
logger = logging.getLogger("app.master_data")


def storage(kind: Kind) -> tuple[type[Record], list[Any], dict[str, str]]:
    """Model, row filter and extra insert values for a kind; facilities have their own table."""
    if kind == "facilities":
        return Facility, [], {}
    return MasterRecord, [MasterRecord.kind == kind], {"kind": kind}


def entity(kind: Kind) -> str:
    return "production_facility" if kind == "facilities" else "master_" + kind


class RecordIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data: dict[str, str | None]


def validate(kind: Kind, data: dict[str, str | None]) -> dict[str, str | None]:
    """Only the code is mandatory on write; other gaps are reported by `missing_fields`."""
    if set(data) - set(FIELDS[kind]):
        logger.warning(
            "master_data.invalid_fields",
            extra={"ctx": {"kind": kind, "unknown_fields": sorted(set(data) - set(FIELDS[kind]))}},
        )
        raise ApiError(
            422, "invalid_fields", "Có thông tin không đúng biểu mẫu. Tải lại trang rồi thử lại."
        )
    result = {
        field: value if (value := data.get(field)) and value.strip() else None
        for field in FIELDS[kind]
    }
    if any(value is not None and len(value) > 10000 for value in result.values()):
        raise ApiError(
            422, "field_too_long", "Có nội dung quá dài (tối đa 10.000 ký tự). Rút gọn rồi lưu lại."
        )
    code = result[FIELDS[kind][0]]
    if code is None:
        raise ApiError(422, "required_fields", "Vui lòng nhập mã cho hồ sơ này.")
    if code != code.strip() or len(code) > 255:
        raise ApiError(
            422,
            "invalid_code",
            "Mã không được có khoảng trắng ở đầu hoặc cuối và tối đa 255 ký tự.",
        )
    return result


async def linked_products(session: AsyncSession) -> dict[uuid.UUID, list[dict[str, str]]]:
    """Catalog products per base product record."""
    rows = await session.execute(
        select(Product.master_product_id, Product.id, Product.name)
        .where(Product.master_product_id.is_not(None))
        .order_by(Product.name)
    )
    result: dict[uuid.UUID, list[dict[str, str]]] = defaultdict(list)
    for master_id, product_id, name in rows.all():
        result[cast(uuid.UUID, master_id)].append({"id": str(product_id), "name": name})
    return result


def serialize(
    kind: Kind, record: Record, links: dict[uuid.UUID, list[dict[str, str]]] | None = None
) -> dict[str, object]:
    result: dict[str, object] = {
        "id": str(record.id),
        "data": record.data,
        "missing_fields": missing_fields(kind, record.data),
    }
    if kind == "products":
        result["linked_products"] = (links or {}).get(record.id, [])
    return result


async def get_record(session: AsyncSession, kind: Kind, record_id: uuid.UUID) -> Record:
    model, filters, _ = storage(kind)
    record = await session.scalar(
        select(model).where(model.id == record_id, *filters).with_for_update()
    )
    if record is None:
        raise ApiError(404, "not_found", "Hồ sơ này không còn tồn tại. Tải lại danh mục.")
    return cast(Record, record)


@router.get("/definitions")
async def definitions() -> dict[str, dict[str, object]]:
    return {
        kind: {
            "fields": fields,
            "required": REQUIRED[kind],
            "conditional_required": CONDITIONAL_REQUIRED[kind],
        }
        for kind, fields in FIELDS.items()
    }


@router.get("/summary")
async def summary(session: Session) -> dict[str, dict[str, int]]:
    result = {kind: {"total": 0, "needs_attention": 0} for kind in FIELDS}
    rows = [
        *(await session.execute(select(MasterRecord.kind, MasterRecord.data))).all(),
        *(("facilities", data) for data in (await session.scalars(select(Facility.data))).all()),
    ]
    for kind, data in rows:
        result[kind]["total"] += 1
        result[kind]["needs_attention"] += bool(missing_fields(kind, data))
    return result


@router.get("/{kind}")
async def list_records(kind: Kind, session: Session) -> list[dict[str, object]]:
    model, filters, _ = storage(kind)
    records = (await session.scalars(select(model).where(*filters).order_by(model.code))).all()
    links = await linked_products(session) if kind == "products" else None
    return [serialize(kind, cast(Record, record), links) for record in records]


@router.post("/{kind}", status_code=201)
async def create_record(
    kind: Kind, payload: RecordIn, session: Session, actor: Actor
) -> dict[str, object]:
    data = validate(kind, payload.data)
    code = data[FIELDS[kind][0]]
    model, _, extra = storage(kind)
    result = await session.execute(
        insert(model)
        .values(code=code, data=data, **extra)
        .on_conflict_do_nothing(index_elements=[*extra, "code"])
        .returning(model)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise ApiError(409, "duplicate_code", "Mã này đã có trong danh mục. Nhập mã khác.")
    await audit.record(session, actor, "create", entity(kind), record.id, None, {"code": code})
    await session.commit()
    logger.info(
        "master_data.record_changed",
        extra={"ctx": {"kind": kind, "record_id": str(record.id), "action": "create"}},
    )
    return serialize(kind, cast(Record, record))


@router.put("/{kind}/{record_id}")
async def update_record(
    kind: Kind, record_id: uuid.UUID, payload: RecordIn, session: Session, actor: Actor
) -> dict[str, object]:
    data = validate(kind, payload.data)
    record = await get_record(session, kind, record_id)
    if data[FIELDS[kind][0]] != record.code:
        raise ApiError(
            422, "immutable_code", "Mã không đổi được sau khi tạo. Tạo hồ sơ mới nếu cần mã khác."
        )
    changed = [field for field in FIELDS[kind] if record.data.get(field) != data[field]]
    # Cooperation status gates facility sign-in, so its effect is kept in the audit trail.
    was_active = record.active if isinstance(record, Facility) else None
    record.data = data
    if changed:
        after: dict[str, object] = {"code": record.code, "fields": changed}
        before = None
        if isinstance(record, Facility):
            before, after["active"] = {"active": was_active}, record.active
        await audit.record(session, actor, "update", entity(kind), record.id, before, after)
    await session.commit()
    logger.info(
        "master_data.record_changed",
        extra={"ctx": {"kind": kind, "record_id": str(record.id), "action": "update"}},
    )
    if isinstance(record, Facility) and was_active != record.active:
        logger.info(
            "master_data.facility_status_changed",
            extra={
                "ctx": {
                    "record_id": str(record.id),
                    "from_active": was_active,
                    "to_active": record.active,
                }
            },
        )
    links = await linked_products(session) if kind == "products" else None
    return serialize(kind, record, links)


@router.delete("/{kind}/{record_id}", status_code=204)
async def delete_record(kind: Kind, record_id: uuid.UUID, session: Session, actor: Actor) -> None:
    record = await get_record(session, kind, record_id)
    await audit.record(
        session, actor, "delete", entity(kind), record.id, {"code": record.code}, None
    )
    await session.delete(record)
    try:
        await session.commit()
    except IntegrityError:
        # Facilities with staff or orders and base products linked from the catalog stay.
        await session.rollback()
        raise ApiError(
            409,
            "in_use",
            "Hồ sơ này đang được dùng nên chưa xóa được. Gỡ liên kết trước rồi thử lại.",
        ) from None
    logger.info(
        "master_data.record_changed",
        extra={"ctx": {"kind": kind, "record_id": str(record_id), "action": "delete"}},
    )
