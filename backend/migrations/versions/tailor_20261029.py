"""Add configurable tailor measurements and order snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "tailor_20261029"
down_revision = "production_20261029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "tailor_measurements", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
    )
    op.add_column(
        "order_lines",
        sa.Column("is_tailor", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "order_lines",
        sa.Column(
            "tailor_measurements", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")
        ),
    )
    op.add_column("order_lines", sa.Column("note", sa.Text(), nullable=True))
    op.add_column(
        "campaign_items",
        sa.Column("tailor_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("campaign_items", "tailor_enabled")
    op.drop_column("order_lines", "note")
    op.drop_column("order_lines", "tailor_measurements")
    op.drop_column("order_lines", "is_tailor")
    op.drop_column("products", "tailor_measurements")
