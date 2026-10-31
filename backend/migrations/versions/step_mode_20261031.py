"""Per-step execution mode and internal (partner-less) assignments."""

import sqlalchemy as sa
from alembic import op

revision = "step_mode_20261031"
down_revision = "assignments_20261030"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "production_campaign_steps",
        sa.Column("mode", sa.Text(), nullable=False, server_default="partners"),
    )
    op.create_check_constraint(
        "ck_production_campaign_steps_mode",
        "production_campaign_steps",
        "mode IN ('partners', 'internal')",
    )
    op.add_column("production_assignments", sa.Column("assignee", sa.Text()))
    op.alter_column("production_assignments", "facility_id", nullable=True)


def downgrade():
    """Destructive: internal assignments (no facility) are deleted."""
    op.execute("DELETE FROM production_assignments WHERE facility_id IS NULL")
    op.alter_column("production_assignments", "facility_id", nullable=False)
    op.drop_column("production_assignments", "assignee")
    op.drop_constraint("ck_production_campaign_steps_mode", "production_campaign_steps")
    op.drop_column("production_campaign_steps", "mode")
