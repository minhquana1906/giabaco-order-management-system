"""Replace production orders and order steps with per-partner step assignments."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "assignments_20261030"
down_revision = "master_seed_20261029"
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


def ref(name, target, nullable=False, cascade=False):
    return sa.Column(
        name,
        pg.UUID(as_uuid=True),
        sa.ForeignKey(target + ".id", ondelete="CASCADE" if cascade else None),
        nullable=nullable,
    )


def upgrade():
    op.drop_table("production_order_steps")
    op.drop_table("production_orders")
    op.create_table(
        "production_assignments",
        *base(),
        ref("campaign_id", "campaigns"),
        sa.Column("step_position", sa.SmallInteger(), nullable=False),
        ref("facility_id", "production_facilities"),
        ref("product_id", "products", nullable=True),
        sa.Column("quantity", sa.Integer()),
        sa.Column("deadline", sa.Date()),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("content", sa.Text()),
        sa.Column("actual_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("step_position BETWEEN 1 AND 10"),
        sa.CheckConstraint("quantity > 0"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')"),
    )
    op.create_index(
        "uq_production_assignments_scope",
        "production_assignments",
        ["campaign_id", "step_position", "facility_id", "product_id"],
        unique=True,
        postgresql_nulls_not_distinct=True,
    )
    op.create_index("ix_production_assignments_campaign", "production_assignments", ["campaign_id"])
    op.create_index("ix_production_assignments_facility", "production_assignments", ["facility_id"])


def downgrade():
    """Destructive: drops assignments and restores the old order tables empty."""
    op.drop_table("production_assignments")
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
        ref("order_id", "production_orders", cascade=True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("deadline", sa.Date()),
        sa.Column("content", sa.Text()),
        sa.Column("actual_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("order_id", "position"),
        sa.CheckConstraint("position BETWEEN 1 AND 10"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')"),
    )
