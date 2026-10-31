"""Catalog tables: schools, classes, products."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.features.master_data import models as _master_data  # noqa: F401 - products FK target


class School(Base):
    __tablename__ = "schools"
    __table_args__ = (CheckConstraint("length(trim(code)) > 0", name="ck_schools_code_not_empty"),)

    name: Mapped[str] = mapped_column(Text)
    code: Mapped[str] = mapped_column(Text, unique=True)


class SchoolClass(Base):
    __tablename__ = "school_classes"
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_school_classes_school_name"),
        UniqueConstraint("school_id", "id", name="uq_school_classes_school_id_id"),
        CheckConstraint("grade BETWEEN 1 AND 12", name="ck_school_classes_grade"),
    )

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"))
    grade: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(Text)


class MeasurementType(Base):
    __tablename__ = "measurement_types"

    key: Mapped[str] = mapped_column(Text, unique=True)
    label: Mapped[str] = mapped_column(Text)
    normalized_label: Mapped[str] = mapped_column(Text, unique=True)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0",
            name="ck_products_sizes",
        ),
        CheckConstraint(
            "jsonb_typeof(colours) = 'array' AND jsonb_array_length(colours) > 0",
            name="ck_products_colours",
        ),
        CheckConstraint(
            "gender_target IN ('MALE', 'FEMALE', 'UNISEX')", name="ck_products_gender_target"
        ),
        CheckConstraint("code ~ '^[a-z0-9_]{2,40}$'", name="ck_products_code"),
    )

    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    sizes: Mapped[list[str]] = mapped_column(JSONB)
    size_guide: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    tailor_measurements: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb"), default=list
    )
    active: Mapped[bool] = mapped_column(server_default=text("true"), default=True)
    position: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), default=0)
    description: Mapped[str | None] = mapped_column(Text)
    gender_target: Mapped[str] = mapped_column(
        String(10), server_default=text("'UNISEX'"), default="UNISEX"
    )
    colours: Mapped[list[str]] = mapped_column(JSONB, server_default=text("""'["ghi"]'::jsonb"""))
    master_product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("master_records.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now().astimezone(),
    )


class ProductImage(Base):
    __tablename__ = "product_images"
    __table_args__ = (
        CheckConstraint("gender IN ('MALE', 'FEMALE')", name="ck_product_images_gender"),
        Index(
            "uq_product_images_active",
            "school_id",
            "product_id",
            "gender",
            "colour",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    gender: Mapped[str] = mapped_column(String(10))
    colour: Mapped[str] = mapped_column(Text)
    path: Mapped[str] = mapped_column(Text)
    width: Mapped[int]
    height: Mapped[int]
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
