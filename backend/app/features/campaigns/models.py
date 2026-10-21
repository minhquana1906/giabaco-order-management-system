"""Campaign tables and the read helper other slices use."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.features.catalog.models import Product

DRAFT = "DRAFT"
OPEN = "OPEN"
LOCKED = "LOCKED"


class Campaign(Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("status IN ('DRAFT', 'OPEN', 'LOCKED')", name="ck_campaigns_status"),
        CheckConstraint("school_year ~ '^[0-9]{4}-[0-9]{4}$'", name="ck_campaigns_school_year"),
        CheckConstraint("closes_at IS NULL OR closes_at > opens_at", name="ck_campaigns_window"),
        CheckConstraint("length(trim(name)) > 0", name="ck_campaigns_name"),
        Index(
            "uq_campaigns_open_per_school",
            "school_id",
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
        ),
    )

    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"))
    name: Mapped[str] = mapped_column(Text)
    school_year: Mapped[str] = mapped_column(Text)
    opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), server_default=text("'DRAFT'"), default=DRAFT)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now().astimezone(),
    )
    items: Mapped[list["CampaignItem"]] = relationship(
        lazy="selectin",
        order_by="CampaignItem.sort, CampaignItem.created_at",
        cascade="all, delete-orphan",
    )
    kits: Mapped[list["CampaignKit"]] = relationship(
        lazy="selectin",
        order_by="CampaignKit.sort, CampaignKit.created_at",
        cascade="all, delete-orphan",
    )


class CampaignItem(Base):
    __tablename__ = "campaign_items"
    __table_args__ = (
        UniqueConstraint("campaign_id", "product_id", name="uq_campaign_items_product"),
        CheckConstraint("unit_price IS NULL OR unit_price >= 0", name="ck_campaign_items_price"),
    )

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    unit_price: Mapped[int | None] = mapped_column(Integer)
    colour: Mapped[str] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), default=0)


class CampaignKit(Base):
    __tablename__ = "campaign_kits"
    __table_args__ = (UniqueConstraint("campaign_id", "code", name="uq_campaign_kits_code"),)

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), default=0)
    slots: Mapped[list["KitSlot"]] = relationship(
        lazy="selectin", order_by="KitSlot.sort, KitSlot.created_at", cascade="all, delete-orphan"
    )


class KitSlot(Base):
    __tablename__ = "kit_slots"
    __table_args__ = (CheckConstraint("qty BETWEEN 1 AND 10", name="ck_kit_slots_qty"),)

    kit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaign_kits.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(Text)
    qty: Mapped[int] = mapped_column(SmallInteger)
    sort: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"), default=0)
    options: Mapped[list["KitSlotOption"]] = relationship(
        lazy="selectin", order_by="KitSlotOption.created_at", cascade="all, delete-orphan"
    )

    @property
    def product_ids(self) -> list[uuid.UUID]:
        return [o.product_id for o in self.options]


class KitSlotOption(Base):
    __tablename__ = "kit_slot_options"
    __table_args__ = (
        UniqueConstraint("slot_id", "product_id", name="uq_kit_slot_options_product"),
    )

    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("kit_slots.id", ondelete="CASCADE"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))


type CampaignView = Campaign


async def open_campaign_for_school(
    session: AsyncSession, school_id: uuid.UUID
) -> CampaignView | None:
    """The school's OPEN campaign with items, kits, slots and options loaded, if any."""
    return await session.scalar(
        select(Campaign).where(Campaign.school_id == school_id, Campaign.status == OPEN)
    )


async def campaign_for_student(
    session: AsyncSession, school_id: uuid.UUID, student_id: uuid.UUID
) -> CampaignView | None:
    """OPEN campaign of the school, else newest LOCKED with the student's SUBMITTED order."""
    from app.features.orders.models import SUBMITTED, Order  # orders.models imports this module

    campaign = await open_campaign_for_school(session, school_id)
    if campaign is not None:
        return campaign
    return await session.scalar(
        select(Campaign)
        .join(Order, Order.campaign_id == Campaign.id)
        .where(
            Campaign.school_id == school_id,
            Campaign.status == LOCKED,
            Order.student_id == student_id,
            Order.status == SUBMITTED,
            Order.deleted_at.is_(None),
        )
        .order_by(Campaign.opens_at.desc())
        .limit(1)
    )


async def school_products(session: AsyncSession, school_id: uuid.UUID) -> list[Product]:
    """Active products in any campaign of the school, in the item order of its newest campaign."""
    rows = await session.execute(
        select(Product)
        .join(CampaignItem, CampaignItem.product_id == Product.id)
        .join(Campaign, Campaign.id == CampaignItem.campaign_id)
        .where(Campaign.school_id == school_id, Product.active)
        .order_by(
            Campaign.created_at.desc(), CampaignItem.sort, CampaignItem.created_at, Product.code
        )
    )
    return list(dict.fromkeys(rows.scalars()))
