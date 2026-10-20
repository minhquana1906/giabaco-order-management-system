"""Colour of a parent size choice."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("parent_size_choices", sa.Column("colour", sa.Text))
    op.create_check_constraint(
        "ck_parent_size_choices_colour",
        "parent_size_choices",
        "colour IN ('navy', 'ghi')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_parent_size_choices_colour", "parent_size_choices")
    op.drop_column("parent_size_choices", "colour")
