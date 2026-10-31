"""Production staff, assignments and progress; facilities live in master_data."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FacilityStaff(Base):
    __tablename__ = "production_staff"
    facility_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("production_facilities.id"))
    username: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))


class CampaignStep(Base):
    __tablename__ = "production_campaign_steps"
    __table_args__ = (
        UniqueConstraint("campaign_id", "position"),
        CheckConstraint("position BETWEEN 1 AND 10"),
        CheckConstraint(
            "mode IN ('partners', 'internal')", name="ck_production_campaign_steps_mode"
        ),
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(Text)
    deadline: Mapped[date | None] = mapped_column(Date)
    mode: Mapped[str] = mapped_column(Text, default="partners", server_default=text("'partners'"))


class Assignment(Base):
    __tablename__ = "production_assignments"
    __table_args__ = (
        CheckConstraint("step_position BETWEEN 1 AND 10"),
        CheckConstraint("quantity > 0"),
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')"),
        Index(
            "uq_production_assignments_scope",
            "campaign_id",
            "step_position",
            "facility_id",
            "product_id",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
        Index("ix_production_assignments_campaign", "campaign_id"),
        Index("ix_production_assignments_facility", "facility_id"),
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id"))
    step_position: Mapped[int] = mapped_column(SmallInteger)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("production_facilities.id"))
    assignee: Mapped[str | None] = mapped_column(Text)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int | None] = mapped_column(Integer)
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, default="pending", server_default=text("'pending'"))
    content: Mapped[str | None] = mapped_column(Text)
    actual_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
