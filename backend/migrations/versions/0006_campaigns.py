"""Campaigns, items, kits, slots and slot options."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def _id() -> sa.Column:
    return sa.Column(
        "id", pg.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def _created() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )


def _fk(name: str, target: str, cascade: bool = False) -> sa.Column:
    return sa.Column(
        name,
        pg.UUID(as_uuid=True),
        sa.ForeignKey(f"{target}.id", ondelete="CASCADE" if cascade else None),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "campaigns",
        _id(),
        _created(),
        _fk("school_id", "schools"),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("school_year", sa.Text, nullable=False),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closes_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(10), nullable=False, server_default="DRAFT"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("status IN ('DRAFT', 'OPEN', 'LOCKED')", name="ck_campaigns_status"),
        sa.CheckConstraint("school_year ~ '^[0-9]{4}-[0-9]{4}$'", name="ck_campaigns_school_year"),
        sa.CheckConstraint("closes_at IS NULL OR closes_at > opens_at", name="ck_campaigns_window"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_campaigns_name"),
    )
    op.create_index(
        "uq_campaigns_open_per_school",
        "campaigns",
        ["school_id"],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
    )
    op.create_table(
        "campaign_items",
        _id(),
        _created(),
        _fk("campaign_id", "campaigns", cascade=True),
        _fk("product_id", "products"),
        sa.Column("unit_price", sa.Integer),
        sa.Column("colour", sa.Text, nullable=False),
        sa.Column("sort", sa.SmallInteger, nullable=False, server_default="0"),
        sa.UniqueConstraint("campaign_id", "product_id", name="uq_campaign_items_product"),
        sa.CheckConstraint("unit_price IS NULL OR unit_price >= 0", name="ck_campaign_items_price"),
    )
    op.create_table(
        "campaign_kits",
        _id(),
        _created(),
        _fk("campaign_id", "campaigns", cascade=True),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("sort", sa.SmallInteger, nullable=False, server_default="0"),
        sa.UniqueConstraint("campaign_id", "code", name="uq_campaign_kits_code"),
    )
    op.create_table(
        "kit_slots",
        _id(),
        _created(),
        _fk("kit_id", "campaign_kits", cascade=True),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("qty", sa.SmallInteger, nullable=False),
        sa.Column("sort", sa.SmallInteger, nullable=False, server_default="0"),
        sa.CheckConstraint("qty BETWEEN 1 AND 10", name="ck_kit_slots_qty"),
    )
    op.create_table(
        "kit_slot_options",
        _id(),
        _created(),
        _fk("slot_id", "kit_slots", cascade=True),
        _fk("product_id", "products"),
        sa.UniqueConstraint("slot_id", "product_id", name="uq_kit_slot_options_product"),
    )


def downgrade() -> None:
    for table in ("kit_slot_options", "kit_slots", "campaign_kits", "campaign_items", "campaigns"):
        op.drop_table(table)
