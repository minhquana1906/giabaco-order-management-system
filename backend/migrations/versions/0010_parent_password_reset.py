"""Parent email becomes mandatory and password reset links are stored."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing accounts predate the mandatory email; the owner chose to start the accounts over.
    op.execute("DELETE FROM parent_student_links")
    op.execute("DELETE FROM parent_accounts")
    op.drop_constraint("ck_parent_accounts_identifier", "parent_accounts", type_="check")
    op.alter_column("parent_accounts", "email", nullable=False)
    op.add_column("parent_accounts", sa.Column("password_changed_at", sa.DateTime(timezone=True)))
    op.create_table(
        "parent_password_resets",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("parent_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_parent_password_resets_parent", "parent_password_resets", ["parent_id"])


def downgrade() -> None:
    op.drop_table("parent_password_resets")
    op.drop_column("parent_accounts", "password_changed_at")
    op.alter_column("parent_accounts", "email", nullable=True)
    op.create_check_constraint(
        "ck_parent_accounts_identifier",
        "parent_accounts",
        "email IS NOT NULL OR phone IS NOT NULL",
    )
