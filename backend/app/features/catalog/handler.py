"""Catalog queries and mutations."""

import asyncio
import io
import logging
import re
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image
from sqlalchemy import exists, func, literal, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import audit
from app.core.config import get_settings
from app.core.errors import ApiError
from app.features.campaigns.models import OPEN, Campaign, CampaignItem, school_products
from app.features.catalog.images import MAX_IMAGE_BYTES, MAX_PIXELS, MEDIA_URL_PREFIX, optimize
from app.features.catalog.measurements import resolve_for_product
from app.features.catalog.models import Product, ProductImage, School, SchoolClass
from app.features.catalog.schemas import (
    ClassIn,
    ProductBody,
    ProductImageOut,
    ProductIn,
    ProductOut,
    ProductUpdate,
    SchoolIn,
    SchoolListOut,
    SchoolUpdate,
)
from app.features.master_data.models import MasterRecord
from app.features.orders.models import OrderLine
from app.features.students.models import FittingTrial

logger = logging.getLogger("app.catalog")

GENDER_SLUG = {"MALE": "nam", "FEMALE": "nu"}
DEFAULT_CLASSES_PER_GRADE = 10


async def list_products(session: AsyncSession, include_inactive: bool = False) -> Sequence[Product]:
    """Products in seed order; inactive ones only on request."""
    query = select(Product).order_by(Product.position, Product.code)
    if not include_inactive:
        query = query.where(Product.active)
    return (await session.scalars(query)).all()


async def _get_product(session: AsyncSession, product_id: uuid.UUID) -> Product:
    product = await session.get(Product, product_id)
    if product is None:
        raise ApiError(
            404, "not_found", "Sản phẩm này không tồn tại hoặc đã bị xóa. Quay lại danh mục."
        )
    return product


def _snapshot(product: Product) -> dict[str, Any]:
    return {
        "code": product.code,
        "name": product.name,
        "description": product.description,
        "sizes": product.sizes,
        "size_guide": product.size_guide,
        "tailor_measurements": product.tailor_measurements,
        "colours": product.colours,
        "gender_target": product.gender_target,
        "master_product_id": str(product.master_product_id) if product.master_product_id else None,
        "active": product.active,
    }


def image_snapshot(image: ProductImage) -> dict[str, Any]:
    return {
        "school_id": str(image.school_id),
        "product_id": str(image.product_id),
        "gender": image.gender,
        "colour": image.colour,
        "path": image.path,
        "width": image.width,
        "height": image.height,
    }


async def products_out(session: AsyncSession, products: Sequence[Product]) -> list[ProductOut]:
    counts: dict[uuid.UUID, dict[str, int]] = {}
    rows = await session.execute(
        select(ProductImage.product_id, ProductImage.school_id, func.count())
        .where(ProductImage.deleted_at.is_(None))
        .group_by(ProductImage.product_id, ProductImage.school_id)
    )
    for product_id, school_id, count in rows:
        counts.setdefault(product_id, {})[str(school_id)] = count
    return [
        ProductOut(
            id=p.id,
            code=p.code,
            name=p.name,
            description=p.description,
            sizes=p.sizes,
            size_guide=p.size_guide,
            tailor_measurements=p.tailor_measurements,
            colours=p.colours,
            gender_target=p.gender_target,
            master_product_id=p.master_product_id,
            active=p.active,
            has_size_guide=bool(p.size_guide),
            school_image_counts=counts.get(p.id, {}),
        )
        for p in products
    ]


async def get_product(session: AsyncSession, product_id: uuid.UUID) -> ProductOut:
    product = await _get_product(session, product_id)
    return (await products_out(session, [product]))[0]


def _guide(body: ProductBody) -> list[dict[str, Any]] | None:
    return [row.model_dump() for row in body.size_guide] if body.size_guide else None


async def _check_master_product(session: AsyncSession, body: ProductBody) -> None:
    if body.master_product_id is None:
        return
    record = await session.get(MasterRecord, body.master_product_id)
    if record is None or record.kind != "products":
        raise ApiError(
            422,
            "validation_error",
            "Sản phẩm gốc đã chọn không hợp lệ. Chọn lại mã sản phẩm gốc.",
            {"master_product_id": "Không tìm thấy sản phẩm gốc"},
        )


async def create_product(session: AsyncSession, payload: ProductIn, actor: str) -> ProductOut:
    await _check_master_product(session, payload)
    position = await session.scalar(select(func.coalesce(func.max(Product.position), -1) + 1))
    product = Product(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        sizes=payload.sizes,
        size_guide=_guide(payload),
        tailor_measurements=await resolve_for_product(session, payload),
        colours=payload.colours,
        gender_target=payload.gender_target,
        master_product_id=payload.master_product_id,
        active=True,
        position=position or 0,
    )
    session.add(product)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ApiError(
            409, "duplicate_product", "Mã sản phẩm này đã tồn tại. Chọn mã khác."
        ) from None
    await audit.record(
        session, actor, "product.create", "product", product.id, None, _snapshot(product)
    )
    await session.commit()
    logger.info("catalog.product_created", extra={"ctx": {"product_id": str(product.id)}})
    return (await products_out(session, [product]))[0]


async def _used(session: AsyncSession, *conditions: Any) -> bool:
    return bool(await session.scalar(select(literal(1)).where(exists().where(*conditions))))


async def _ensure_not_in_use(
    session: AsyncSession, product: Product, payload: ProductUpdate
) -> None:
    removed_sizes = set(product.sizes) - set(payload.sizes)
    removed_colours = set(product.colours) - set(payload.colours)
    if removed_sizes and (
        await _used(
            session,
            FittingTrial.product_id == product.id,
            FittingTrial.size_label.in_(removed_sizes),
            FittingTrial.deleted_at.is_(None),
        )
        or await _used(
            session, OrderLine.product_id == product.id, OrderLine.size_label.in_(removed_sizes)
        )
    ):
        logger.warning(
            "catalog.size_in_use",
            extra={"ctx": {"product_id": str(product.id), "sizes": sorted(removed_sizes)}},
        )
        raise ApiError(
            409,
            "in_use",
            "Cỡ này đã được đặt hoặc đang nằm trong đợt đăng ký nên chưa thể xóa.",
        )
    if removed_colours and (
        await _used(
            session, CampaignItem.product_id == product.id, CampaignItem.colour.in_(removed_colours)
        )
        or await _used(
            session, OrderLine.product_id == product.id, OrderLine.colour.in_(removed_colours)
        )
    ):
        logger.warning(
            "catalog.colour_in_use",
            extra={"ctx": {"product_id": str(product.id), "colours": sorted(removed_colours)}},
        )
        raise ApiError(409, "in_use", "Màu này đang dùng trong đợt đăng ký nên chưa thể xóa.")


async def update_product(
    session: AsyncSession, product_id: uuid.UUID, payload: ProductUpdate, actor: str
) -> ProductOut:
    product = await _get_product(session, product_id)
    await _ensure_not_in_use(session, product, payload)
    await _check_master_product(session, payload)
    before = _snapshot(product)
    product.name = payload.name
    product.description = payload.description
    product.sizes = payload.sizes
    product.size_guide = _guide(payload)
    if payload.tailor_measurements is not None:
        product.tailor_measurements = await resolve_for_product(session, payload)
    product.colours = payload.colours
    product.gender_target = payload.gender_target
    product.master_product_id = payload.master_product_id
    product.updated_at = datetime.now(UTC)
    hiding = product.active and not payload.active
    product.active = payload.active
    await audit.record(
        session,
        actor,
        "product.hide" if hiding else "product.update",
        "product",
        product.id,
        before,
        _snapshot(product),
    )
    await session.commit()
    logger.info(
        "catalog.product_hidden" if hiding else "catalog.product_updated",
        extra={"ctx": {"product_id": str(product.id)}},
    )
    return (await products_out(session, [product]))[0]


def image_out(image: ProductImage) -> ProductImageOut:
    return ProductImageOut(
        id=image.id,
        school_id=image.school_id,
        product_id=image.product_id,
        gender=image.gender,
        colour=image.colour,
        url=MEDIA_URL_PREFIX + image.path,
        width=image.width,
        height=image.height,
    )


async def list_images(
    session: AsyncSession, product_id: uuid.UUID, school_id: uuid.UUID | None
) -> list[ProductImageOut]:
    await _get_product(session, product_id)
    query = select(ProductImage).where(
        ProductImage.product_id == product_id, ProductImage.deleted_at.is_(None)
    )
    if school_id is not None:
        query = query.where(ProductImage.school_id == school_id)
    rows = await session.scalars(query.order_by(ProductImage.gender, ProductImage.colour))
    return [image_out(i) for i in rows]


def media_root() -> Path:
    return Path(get_settings().media_dir).resolve()


def _file_error(message: str) -> ApiError:
    return ApiError(422, "validation_error", "Dữ liệu không hợp lệ", {"file": message})


def _reject_reason(data: bytes) -> str:
    """Why optimize() refused the file; reads the header only."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            return "pixels" if img.width * img.height > MAX_PIXELS else "format"
    except Image.DecompressionBombError:
        return "pixels"
    except Exception:
        return "format"


async def add_image(
    session: AsyncSession,
    product_id: uuid.UUID,
    school_id: uuid.UUID,
    gender: str,
    colour: str,
    data: bytes,
    actor: str,
) -> ProductImageOut:
    product = await _get_product(session, product_id)
    school = await _get_school(session, school_id)
    if colour not in product.colours:
        message = "Màu đã chọn không thuộc sản phẩm này."
        raise ApiError(422, "validation_error", message, {"colour": message})
    if len(data) > MAX_IMAGE_BYTES:
        raise _file_error("Ảnh lớn hơn 5 MB. Chọn ảnh nhỏ hơn rồi thử lại.")
    # Pillow decode and encode are CPU-bound; keep them off the event loop.
    image_file = await asyncio.to_thread(optimize, data)
    if image_file is None:
        logger.warning(
            "catalog.image_rejected",
            extra={
                "ctx": {
                    "product_id": str(product_id),
                    "reason": _reject_reason(data),
                    "bytes": len(data),
                }
            },
        )
        raise _file_error(
            "Chỉ nhận ảnh WebP, JPEG hoặc PNG, tối đa 25 megapixel. Chọn ảnh khác rồi thử lại."
        )
    school_slug = re.sub(r"[^a-z0-9_-]", "_", school.code.lower())
    relative = (
        f"products/{school_slug}/{product.code}_{GENDER_SLUG[gender]}_{colour}"
        f"_{uuid.uuid4().hex[:8]}.webp"
    )
    target = media_root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(image_file.data)
    try:
        old = await session.scalar(
            select(ProductImage).where(
                ProductImage.school_id == school_id,
                ProductImage.product_id == product_id,
                ProductImage.gender == gender,
                ProductImage.colour == colour,
                ProductImage.deleted_at.is_(None),
            )
        )
        if old is not None:
            old.deleted_at = datetime.now(UTC)
            await session.flush()
            await audit.record(
                session, actor, "product_image.replace", "product_image", old.id,
                image_snapshot(old), None,
            )  # fmt: skip
        image = ProductImage(
            school_id=school_id,
            product_id=product_id,
            gender=gender,
            colour=colour,
            path=relative,
            width=image_file.width,
            height=image_file.height,
        )
        session.add(image)
        await session.flush()
        await audit.record(
            session, actor, "product_image.create", "product_image", image.id,
            None, image_snapshot(image),
        )  # fmt: skip
        await session.commit()
    except IntegrityError:
        await session.rollback()
        target.unlink(missing_ok=True)
        logger.warning(
            "catalog.image_conflict",
            extra={"ctx": {"product_id": str(product_id), "colour": colour}},
        )
        raise ApiError(
            409, "conflict", "Ảnh vừa được cập nhật ở nơi khác. Tải lại trang rồi thử lại."
        ) from None
    except Exception:
        target.unlink(missing_ok=True)
        raise
    logger.info(
        "catalog.image_replaced" if old is not None else "catalog.image_uploaded",
        extra={
            "ctx": {
                "product_id": str(product_id),
                "colour": colour,
                "bytes": len(image_file.data),
            }
        },
    )
    return image_out(image)


async def delete_image(
    session: AsyncSession, product_id: uuid.UUID, image_id: uuid.UUID, actor: str
) -> None:
    image = await session.get(ProductImage, image_id)
    if image is None or image.product_id != product_id or image.deleted_at is not None:
        raise ApiError(404, "not_found", "Ảnh này đã bị xóa. Tải lại trang.")
    image.deleted_at = datetime.now(UTC)
    await audit.record(
        session, actor, "product_image.delete", "product_image", image.id,
        image_snapshot(image), None,
    )  # fmt: skip
    await session.commit()
    logger.info(
        "catalog.image_deleted",
        extra={"ctx": {"product_id": str(product_id), "colour": image.colour}},
    )


async def list_schools(session: AsyncSession) -> list[SchoolListOut]:
    open_exists = exists().where(Campaign.school_id == School.id, Campaign.status == OPEN)
    rows = await session.execute(select(School, open_exists).order_by(School.name, School.code))
    return [
        SchoolListOut(id=s.id, name=s.name, code=s.code, has_open_campaign=bool(is_open))
        for s, is_open in rows
    ]


async def create_school(session: AsyncSession, payload: SchoolIn) -> School:
    school = School(name=payload.name, code=payload.code)
    session.add(school)
    try:
        await session.flush()
        session.add_all(
            SchoolClass(school_id=school.id, grade=g, name=f"{g}A{n}")
            for g in sorted(set(payload.grades))
            for n in range(1, DEFAULT_CLASSES_PER_GRADE + 1)
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "duplicate_school", "Mã trường này đã tồn tại. Chọn mã khác.") from None
    return school


async def school_products_out(session: AsyncSession, school_id: uuid.UUID) -> list[ProductOut]:
    await _get_school(session, school_id)
    return await products_out(session, await school_products(session, school_id))


async def _get_school(session: AsyncSession, school_id: uuid.UUID) -> School:
    school = await session.get(School, school_id)
    if school is None:
        raise ApiError(404, "not_found", "Trường này không còn trong hệ thống. Tải lại trang.")
    return school


async def list_classes(session: AsyncSession, school_id: uuid.UUID) -> Sequence[SchoolClass]:
    await _get_school(session, school_id)
    result = await session.scalars(
        select(SchoolClass)
        .where(SchoolClass.school_id == school_id)
        .order_by(SchoolClass.grade, func.length(SchoolClass.name), SchoolClass.name)
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
        raise ApiError(
            409, "duplicate_class", "Lớp này đã có trong trường. Đổi tên lớp khác."
        ) from None
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
        raise ApiError(404, "not_found", "Lớp này không còn trong hệ thống. Tải lại trang.")
    school_class.grade = payload.grade
    school_class.name = payload.name
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(
            409, "duplicate_class", "Lớp này đã có trong trường. Đổi tên lớp khác."
        ) from None
    return school_class
