"""Student and fitting trial tables."""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

HEIGHT_RANGE = (90, 190)
WEIGHT_RANGE = (10, 90)


class Gender(enum.StrEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class Fit(enum.StrEnum):
    TOO_TIGHT = "TOO_TIGHT"
    FITS = "FITS"
    TOO_LOOSE = "TOO_LOOSE"


class DataSource(enum.StrEnum):
    ADMIN_MEASURED = "ADMIN_MEASURED"
    PARENT_DECLARED = "PARENT_DECLARED"


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        ForeignKeyConstraint(
            ["school_id", "class_id"],
            ["school_classes.school_id", "school_classes.id"],
            name="fk_students_school_class",
        ),
        CheckConstraint(
            f"height_cm BETWEEN {HEIGHT_RANGE[0]} AND {HEIGHT_RANGE[1]}", name="ck_students_height"
        ),
        CheckConstraint(
            f"weight_kg BETWEEN {WEIGHT_RANGE[0]} AND {WEIGHT_RANGE[1]}", name="ck_students_weight"
        ),
    )

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"))
    class_id: Mapped[uuid.UUID]
    full_name: Mapped[str] = mapped_column(Text)
    dob: Mapped[date] = mapped_column(Date)
    gender: Mapped[Gender] = mapped_column(
        Enum(Gender, name="gender", native_enum=False, length=10)
    )
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    parent_name: Mapped[str | None] = mapped_column(Text)
    parent_phone: Mapped[str | None] = mapped_column(Text)
    parent_email: Mapped[str | None] = mapped_column(Text)
    portal_token: Mapped[str] = mapped_column(Text, unique=True)
    data_source: Mapped[DataSource] = mapped_column(
        Enum(DataSource, name="data_source", native_enum=False, length=20),
        default=DataSource.ADMIN_MEASURED,
        server_default=DataSource.ADMIN_MEASURED.value,
    )
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FittingTrial(Base):
    __tablename__ = "fitting_trials"
    __table_args__ = (
        Index(
            "uq_fitting_trials_active",
            "student_id",
            "product_id",
            "size_label",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        CheckConstraint("note IS NULL OR length(note) <= 500", name="ck_fitting_trials_note"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    size_label: Mapped[str] = mapped_column(Text)
    suggested_size_label: Mapped[str | None] = mapped_column(Text)
    fit: Mapped[Fit] = mapped_column(Enum(Fit, name="fit", native_enum=False, length=10))
    note: Mapped[str | None] = mapped_column(Text)
    tried_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
