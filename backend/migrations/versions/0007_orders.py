"""Orders, order kit lines, order lines and the order code sequence."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0007"
down_revision = "0006"
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


def upgrade() -> None:
    op.execute("CREATE SEQUENCE order_code_seq")
    op.create_table(
        "orders",
        _id(),
        _created(),
        sa.Column(
            "campaign_id", pg.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False
        ),
        sa.Column("code", sa.Text, nullable=False, unique=True),
        sa.Column("student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id")),
        sa.Column("recipient_name", sa.Text, nullable=False),
        sa.Column("parent_name", sa.Text),
        sa.Column("parent_phone", sa.Text),
        sa.Column("gender", sa.String(10)),
        sa.Column("class_label", sa.Text),
        sa.Column("default_size", sa.Text),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="DRAFT"),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("note", sa.Text),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "gender IS NULL OR gender IN ('MALE', 'FEMALE')", name="ck_orders_gender"
        ),
        sa.CheckConstraint(
            "source IN ('PARENT', 'STAFF', 'LEGACY_IMPORT')", name="ck_orders_source"
        ),
        sa.CheckConstraint("status IN ('DRAFT', 'SUBMITTED')", name="ck_orders_status"),
        sa.CheckConstraint("note IS NULL OR length(note) <= 500", name="ck_orders_note"),
        sa.CheckConstraint(
            "(status = 'SUBMITTED') = (submitted_at IS NOT NULL)", name="ck_orders_submitted_at"
        ),
    )
    op.create_index(
        "uq_orders_student_per_campaign",
        "orders",
        ["campaign_id", "student_id"],
        unique=True,
        postgresql_where=sa.text("student_id IS NOT NULL AND deleted_at IS NULL"),
    )
    op.create_index("ix_orders_campaign_id", "orders", ["campaign_id"])
    op.create_table(
        "order_kit_lines",
        _id(),
        _created(),
        sa.Column(
            "order_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kit_id", pg.UUID(as_uuid=True), sa.ForeignKey("campaign_kits.id"), nullable=False
        ),
        sa.Column("qty", sa.SmallInteger, nullable=False),
        sa.CheckConstraint("qty BETWEEN 1 AND 10", name="ck_order_kit_lines_qty"),
    )
    op.create_index("ix_order_kit_lines_order_id", "order_kit_lines", ["order_id"])
    op.create_table(
        "order_lines",
        _id(),
        _created(),
        sa.Column(
            "order_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kit_line_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("order_kit_lines.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "slot_id", pg.UUID(as_uuid=True), sa.ForeignKey("kit_slots.id", ondelete="SET NULL")
        ),
        sa.Column(
            "product_id", pg.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False
        ),
        sa.Column("size_label", sa.Text, nullable=False),
        sa.Column("colour", sa.Text, nullable=False),
        sa.Column("qty", sa.SmallInteger, nullable=False),
        sa.Column("unit_price", sa.Integer),
        sa.CheckConstraint("qty BETWEEN 1 AND 20", name="ck_order_lines_qty"),
        sa.CheckConstraint("unit_price IS NULL OR unit_price >= 0", name="ck_order_lines_price"),
    )
    op.create_index("ix_order_lines_order_id", "order_lines", ["order_id"])


def downgrade() -> None:
    for table in ("order_lines", "order_kit_lines", "orders"):
        op.drop_table(table)
    op.execute("DROP SEQUENCE order_code_seq")
