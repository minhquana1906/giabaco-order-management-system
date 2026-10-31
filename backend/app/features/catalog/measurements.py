"""Shared catalog of tailor measurement types; products reference them by generated key."""

import logging
import unicodedata
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.errors import ApiError
from app.features.catalog.models import MeasurementType, Product
from app.features.catalog.schemas import (
    MeasurementTypeCreate,
    MeasurementTypeOut,
    MeasurementTypeRename,
    ProductBody,
)

logger = logging.getLogger("app.catalog")


def normalize(label: str) -> str:
    """Exact-duplicate key: NFC, collapsed whitespace, case-insensitive."""
    return " ".join(unicodedata.normalize("NFC", label).split()).casefold()


def loose(label: str) -> str:
    """Near-duplicate key: also ignores diacritics and punctuation."""
    stripped = "".join(
        c for c in unicodedata.normalize("NFD", label) if unicodedata.category(c) != "Mn"
    )
    return "".join(
        c for c in stripped.replace("đ", "d").replace("Đ", "D").casefold() if c.isalnum()
    )


def _duplicate() -> ApiError:
    return ApiError(
        409, "duplicate_measurement", "Loại số đo này đã có trong danh mục. Hãy chọn loại đã có."
    )


async def list_types(session: AsyncSession) -> list[MeasurementTypeOut]:
    rows = (await session.scalars(select(MeasurementType).order_by(MeasurementType.label))).all()
    return [MeasurementTypeOut(key=r.key, label=r.label) for r in rows]


async def create_type(
    session: AsyncSession, payload: MeasurementTypeCreate, actor: str
) -> MeasurementTypeOut:
    existing = (await session.scalars(select(MeasurementType))).all()
    normalized = normalize(payload.label)
    if any(r.normalized_label == normalized for r in existing):
        raise _duplicate()
    similar = [r.label for r in existing if loose(r.label) == loose(payload.label)]
    if similar and not payload.confirm_similar:
        raise ApiError(
            409,
            "similar_measurement",
            f"Danh mục đã có loại số đo gần giống: {', '.join(similar)}. "
            "Hãy chọn loại đã có, hoặc xác nhận nếu đây là số đo khác.",
        )
    record = MeasurementType(
        key=f"sd_{uuid.uuid4().hex[:12]}", label=payload.label, normalized_label=normalized
    )
    session.add(record)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise _duplicate() from None
    await audit.record(
        session,
        actor,
        "measurement_type.create",
        "measurement_type",
        record.id,
        None,
        {"key": record.key, "label": record.label},
    )
    await session.commit()
    logger.info("catalog.measurement_type_created", extra={"ctx": {"key": record.key}})
    return MeasurementTypeOut(key=record.key, label=record.label)


async def rename_type(
    session: AsyncSession, key: str, payload: MeasurementTypeRename, actor: str
) -> MeasurementTypeOut:
    record = await session.scalar(
        select(MeasurementType).where(MeasurementType.key == key).with_for_update()
    )
    if record is None:
        raise ApiError(404, "not_found", "Loại số đo này không tồn tại. Tải lại danh sách.")
    normalized = normalize(payload.label)
    taken = await session.scalar(
        select(MeasurementType.id).where(
            MeasurementType.normalized_label == normalized, MeasurementType.key != key
        )
    )
    if taken:
        raise _duplicate()
    before = {"label": record.label}
    record.label, record.normalized_label = payload.label, normalized
    products = (
        await session.scalars(
            select(Product)
            .where(Product.tailor_measurements.contains([{"key": key}]))
            .with_for_update()
        )
    ).all()
    for product in products:
        product.tailor_measurements = [
            {**m, "label": payload.label} if m["key"] == key else m
            for m in product.tailor_measurements
        ]
    await audit.record(
        session,
        actor,
        "measurement_type.rename",
        "measurement_type",
        record.id,
        before,
        {"label": record.label, "products": len(products)},
    )
    await session.commit()
    logger.info(
        "catalog.measurement_type_renamed", extra={"ctx": {"key": key, "products": len(products)}}
    )
    return MeasurementTypeOut(key=record.key, label=record.label)


async def resolve_for_product(session: AsyncSession, body: ProductBody) -> list[dict[str, Any]]:
    """Product measurement fields with labels taken from the catalog; unknown keys are rejected."""
    fields = body.tailor_measurements or []
    if not fields:
        return []
    types = {
        r.key: r.label
        for r in (
            await session.scalars(
                select(MeasurementType)
                .where(MeasurementType.key.in_([f.key for f in fields]))
                .with_for_update(read=True)
            )
        ).all()
    }
    unknown = [f.key for f in fields if f.key not in types]
    if unknown:
        raise ApiError(
            422,
            "validation_error",
            "Có loại số đo chưa nằm trong danh mục. Hãy chọn từ danh sách hoặc tạo loại mới.",
            {"tailor_measurements": "Loại số đo không có trong danh mục"},
        )
    return [{**f.model_dump(), "label": types[f.key]} for f in fields]
