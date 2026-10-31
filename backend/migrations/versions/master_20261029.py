"""Create independent master records and link catalog products to a base product."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "master_20261029"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_records",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint("kind", "code", name="uq_master_records_kind_code"),
        sa.CheckConstraint(
            "kind IN ('materials', 'suppliers', 'products')", name="ck_master_records_kind"
        ),
        sa.CheckConstraint("length(trim(code)) > 0", name="ck_master_records_code"),
    )
    op.add_column(
        "products",
        sa.Column(
            "master_product_id", sa.UUID(), sa.ForeignKey("master_records.id"), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "master_product_id")
    op.drop_table("master_records")
