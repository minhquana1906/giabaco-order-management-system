"""Parent accounts, parent-student links and students.data_source."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002"
down_revision = "0001"
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
    op.add_column(
        "students",
        sa.Column(
            "data_source",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'ADMIN_MEASURED'"),
        ),
    )
    op.create_check_constraint(
        "ck_students_data_source",
        "students",
        "data_source IN ('ADMIN_MEASURED', 'PARENT_DECLARED')",
    )
    op.create_table(
        "parent_accounts",
        *_base(),
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, unique=True),
        sa.Column("phone", sa.Text, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.CheckConstraint(
            "email IS NOT NULL OR phone IS NOT NULL", name="ck_parent_accounts_identifier"
        ),
    )
    op.create_table(
        "parent_student_links",
        *_base(),
        sa.Column(
            "parent_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("parent_accounts.id"),
            nullable=False,
        ),
        sa.Column(
            "student_id", pg.UUID(as_uuid=True), sa.ForeignKey("students.id"), nullable=False
        ),
        sa.Column("origin", sa.String(10), nullable=False),
        sa.UniqueConstraint("parent_id", "student_id", name="uq_parent_student_links_pair"),
        sa.CheckConstraint(
            "origin IN ('CLAIMED', 'CREATED')", name="ck_parent_student_links_origin"
        ),
    )
    op.create_index("ix_parent_student_links_student", "parent_student_links", ["student_id"])


def downgrade() -> None:
    op.drop_table("parent_student_links")
    op.drop_table("parent_accounts")
    op.drop_constraint("ck_students_data_source", "students")
    op.drop_column("students", "data_source")
