"""Product profile columns and per-school product images."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("description", sa.Text))
    op.add_column(
        "products",
        sa.Column("gender_target", sa.String(10), nullable=False, server_default="UNISEX"),
    )
    op.add_column(
        "products",
        sa.Column(
            "colours", pg.JSONB, nullable=False, server_default=sa.text("""'["ghi"]'::jsonb""")
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_check_constraint(
        "ck_products_gender_target", "products", "gender_target IN ('MALE', 'FEMALE', 'UNISEX')"
    )
    op.create_check_constraint(
        "ck_products_colours",
        "products",
        "jsonb_typeof(colours) = 'array' AND jsonb_array_length(colours) > 0",
    )
    op.create_check_constraint("ck_products_code", "products", "code ~ '^[a-z0-9_]{2,40}$'")
    op.create_table(
        "product_images",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column(
            "product_id", pg.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False
        ),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("colour", sa.Text, nullable=False),
        sa.Column("path", sa.Text, nullable=False),
        sa.Column("width", sa.Integer, nullable=False),
        sa.Column("height", sa.Integer, nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("gender IN ('MALE', 'FEMALE')", name="ck_product_images_gender"),
    )
    op.create_index(
        "uq_product_images_active",
        "product_images",
        ["school_id", "product_id", "gender", "colour"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("product_images")
    op.drop_constraint("ck_products_code", "products")
    op.drop_constraint("ck_products_colours", "products")
    op.drop_constraint("ck_products_gender_target", "products")
    for column in ("updated_at", "colours", "gender_target", "description"):
        op.drop_column("products", column)
