"""Order tables."""

import uuid
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.features.campaigns import models as _campaigns  # noqa: F401
from app.features.catalog import models as _catalog  # noqa: F401
from app.features.students import models as _students  # noqa: F401

DRAFT = "DRAFT"
SUBMITTED = "SUBMITTED"
PARENT = "PARENT"
STAFF = "STAFF"
LEGACY_IMPORT = "LEGACY_IMPORT"


class OrderTotals(NamedTuple):
    items: int
    amount: int
    has_unpriced: bool


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("gender IS NULL OR gender IN ('MALE', 'FEMALE')", name="ck_orders_gender"),
        CheckConstraint("source IN ('PARENT', 'STAFF', 'LEGACY_IMPORT')", name="ck_orders_source"),
        CheckConstraint("status IN ('DRAFT', 'SUBMITTED')", name="ck_orders_status"),
        CheckConstraint("note IS NULL OR length(note) <= 500", name="ck_orders_note"),
        CheckConstraint(
            "(status = 'SUBMITTED') = (submitted_at IS NOT NULL)", name="ck_orders_submitted_at"
        ),
        Index(
            "uq_orders_student_per_campaign",
            "campaign_id",
            "student_id",
            unique=True,
            postgresql_where=text("student_id IS NOT NULL AND deleted_at IS NULL"),
        ),
    )

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id"), index=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    student_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("students.id"))
    recipient_name: Mapped[str] = mapped_column(Text)
    parent_name: Mapped[str | None] = mapped_column(Text)
    parent_phone: Mapped[str | None] = mapped_column(Text)
    gender: Mapped[str | None] = mapped_column(String(10))
    class_label: Mapped[str | None] = mapped_column(Text)
    default_size: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(10), server_default=text("'DRAFT'"), default=DRAFT)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now().astimezone(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    kit_lines: Mapped[list["OrderKitLine"]] = relationship(
        lazy="selectin", order_by="OrderKitLine.created_at", cascade="all, delete-orphan"
    )
    lines: Mapped[list["OrderLine"]] = relationship(
        lazy="selectin", order_by="OrderLine.created_at", cascade="all, delete-orphan"
    )

    @property
    def totals(self) -> OrderTotals:
        priced = [line for line in self.lines if line.unit_price is not None]
        return OrderTotals(
            items=sum(line.qty for line in self.lines),
            amount=sum(line.qty * (line.unit_price or 0) for line in priced),
            has_unpriced=len(priced) < len(self.lines),
        )


class OrderKitLine(Base):
    __tablename__ = "order_kit_lines"
    __table_args__ = (CheckConstraint("qty BETWEEN 1 AND 10", name="ck_order_kit_lines_qty"),)

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    kit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaign_kits.id"))
    qty: Mapped[int] = mapped_column(SmallInteger)


class OrderLine(Base):
    __tablename__ = "order_lines"
    __table_args__ = (
        CheckConstraint("qty BETWEEN 1 AND 20", name="ck_order_lines_qty"),
        CheckConstraint("unit_price IS NULL OR unit_price >= 0", name="ck_order_lines_price"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    kit_line_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("order_kit_lines.id", ondelete="CASCADE")
    )
    slot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("kit_slots.id", ondelete="SET NULL")
    )
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    size_label: Mapped[str] = mapped_column(Text)
    colour: Mapped[str] = mapped_column(Text)
    qty: Mapped[int] = mapped_column(SmallInteger)
    unit_price: Mapped[int | None] = mapped_column(Integer)
