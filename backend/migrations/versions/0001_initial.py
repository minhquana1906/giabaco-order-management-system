"""Initial schema."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

UUID_PK = dict(server_default=sa.text("gen_random_uuid()"), nullable=False)
NOW = sa.text("now()")


def _base() -> list[sa.Column]:
    return [
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True, **UUID_PK),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")

    op.create_table(
        "schools",
        *_base(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("code", sa.Text, nullable=False, unique=True),
        sa.CheckConstraint("length(trim(code)) > 0", name="ck_schools_code_not_empty"),
    )
    op.create_table(
        "school_classes",
        *_base(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("grade", sa.SmallInteger, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.UniqueConstraint("school_id", "name", name="uq_school_classes_school_name"),
        sa.UniqueConstraint("school_id", "id", name="uq_school_classes_school_id_id"),
        sa.CheckConstraint("grade BETWEEN 1 AND 12", name="ck_school_classes_grade"),
    )
    op.create_table(
        "products",
        *_base(),
        sa.Column("code", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("sizes", pg.JSONB, nullable=False),
        sa.Column("size_guide", pg.JSONB),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("position", sa.SmallInteger, nullable=False, server_default=sa.text("0")),
        sa.CheckConstraint(
            "jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0",
            name="ck_products_sizes",
        ),
    )
    op.create_table(
        "students",
        *_base(),
        sa.Column("school_id", pg.UUID(as_uuid=True), sa.ForeignKey("schools.id"), nullable=False),
        sa.Column("class_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("dob", sa.Date, nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 1), nullable=False),
        sa.Column("weight_kg", sa.Numeric(4, 1), nullable=False),
        sa.Column("parent_name", sa.Text),
        sa.Column("parent_phone", sa.Text),
        sa.Column("parent_email", sa.Text),
        sa.Column("portal_token", sa.Text, nullable=False, unique=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["school_id", "class_id"],
            ["school_classes.school_id", "school_classes.id"],
            name="fk_students_school_class",
        ),
        sa.CheckConstraint("height_cm BETWEEN 90 AND 190", name="ck_students_height"),
        sa.CheckConstraint("weight_kg BETWEEN 10 AND 90", name="ck_students_weight"),
        sa.CheckConstraint("gender IN ('MALE', 'FEMALE')", name="ck_students_gender"),
    )
    op.create_index("ix_students_school_class", "students", ["school_id", "class_id"])
    op.create_table(
        "fitting_trials",
        *_base(),
        sa.Column(
            "student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=False
        ),
        sa.Column(
            "product_id", pg.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False
        ),
        sa.Column("size_label", sa.Text, nullable=False),
        sa.Column("suggested_size_label", sa.Text),
        sa.Column("fit", sa.String(10), nullable=False),
        sa.Column("note", sa.Text),
        sa.Column("tried_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "fit IN ('TOO_TIGHT', 'FITS', 'TOO_LOOSE')", name="ck_fitting_trials_fit"
        ),
        sa.CheckConstraint("note IS NULL OR length(note) <= 500", name="ck_fitting_trials_note"),
    )
    op.create_index(
        "uq_fitting_trials_active",
        "fitting_trials",
        ["student_id", "product_id", "size_label"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_table(
        "parent_size_choices",
        *_base(),
        sa.Column(
            "student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=False
        ),
        sa.Column(
            "product_id", pg.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False
        ),
        sa.Column("size_label", sa.Text, nullable=False),
        sa.Column("chosen_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.UniqueConstraint(
            "student_id", "product_id", name="uq_parent_size_choices_student_product"
        ),
    )
    op.create_table(
        "audit_logs",
        *_base(),
        sa.Column("at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("actor", sa.Text, nullable=False),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("entity", sa.Text, nullable=False),
        sa.Column("entity_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("before", pg.JSONB),
        sa.Column("after", pg.JSONB),
    )
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity", "entity_id"])
    op.execute(
        """
        CREATE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_logs_no_change
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_logs_no_change ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_append_only()")
    for table in (
        "audit_logs",
        "parent_size_choices",
        "fitting_trials",
        "students",
        "products",
        "school_classes",
        "schools",
    ):
        op.drop_table(table)
