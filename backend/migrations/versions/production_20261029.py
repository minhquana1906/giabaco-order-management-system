"""Production facilities, campaign steps, orders and progress."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "production_20261029"
down_revision = "master_20261029"
branch_labels = None
depends_on = None


def base():
    return [
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    ]


def ref(name, target, cascade=False):
    return sa.Column(
        name,
        pg.UUID(as_uuid=True),
        sa.ForeignKey(target + ".id", ondelete="CASCADE" if cascade else None),
        nullable=False,
    )


def upgrade():
    op.create_table(
        "production_facilities",
        *base(),
        sa.Column("code", sa.Text(), nullable=False, unique=True),
        sa.Column("data", pg.JSONB(), nullable=False),
        sa.CheckConstraint("length(trim(code)) > 0", name="ck_production_facilities_code"),
    )
    op.create_table(
        "production_staff",
        *base(),
        ref("facility_id", "production_facilities"),
        sa.Column("username", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("disabled_at", sa.DateTime(timezone=True)),
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "production_campaign_steps",
        *base(),
        ref("campaign_id", "campaigns", True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("deadline", sa.Date()),
        sa.UniqueConstraint("campaign_id", "position"),
        sa.CheckConstraint("position BETWEEN 1 AND 10"),
        sa.CheckConstraint("length(trim(name)) > 0"),
    )
    op.create_table(
        "production_orders",
        *base(),
        ref("campaign_id", "campaigns"),
        ref("product_id", "products"),
        ref("facility_id", "production_facilities"),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("deadline", sa.Date()),
        sa.CheckConstraint("quantity > 0"),
    )
    op.create_index("ix_production_orders_facility", "production_orders", ["facility_id"])
    op.create_index("ix_production_orders_campaign", "production_orders", ["campaign_id"])
    op.create_table(
        "production_order_steps",
        *base(),
        ref("order_id", "production_orders", True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("deadline", sa.Date()),
        sa.Column("content", sa.Text()),
        sa.Column("actual_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("order_id", "position"),
        sa.CheckConstraint("position BETWEEN 1 AND 10"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')"),
    )


def downgrade():
    for table in (
        "production_order_steps",
        "production_orders",
        "production_campaign_steps",
        "production_staff",
        "production_facilities",
    ):
        op.drop_table(table)
