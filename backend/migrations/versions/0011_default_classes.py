"""Every school gets default classes {grade}A1..{grade}A10 for grades 1-12."""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO school_classes (school_id, grade, name)
        SELECT s.id, g, g || 'A' || n
        FROM schools s, generate_series(1, 12) g, generate_series(1, 10) n
        ON CONFLICT (school_id, name) DO NOTHING
        """
    )


def downgrade() -> None:
    pass
