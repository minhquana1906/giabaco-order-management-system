"""Catalog tables: schools, classes, products."""

import uuid
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


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


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint(
            "jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0",
            name="ck_products_sizes",
        ),
    )

    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    sizes: Mapped[list[str]] = mapped_column(JSONB)
    size_guide: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    active: Mapped[bool] = mapped_column(server_default=text("true"), default=True)
    position: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), default=0)
