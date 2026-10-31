"""Seed master records and production facilities from config/master.seed.yaml."""

from pathlib import Path

import sqlalchemy as sa
import yaml
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "master_seed_20261029"
down_revision = "tailor_20261029"
branch_labels = None
depends_on = None

SEED = Path(__file__).resolve().parents[2] / "config" / "master.seed.yaml"
CODE_FIELD = {
    "materials": "Mã NPL",
    "suppliers": "Mã NCC",
    "products": "Mã SP nền",
    "facilities": "Mã cơ sở",
}
master_records = sa.table(
    "master_records",
    sa.column("kind", sa.Text),
    sa.column("code", sa.Text),
    sa.column("data", postgresql.JSONB),
)
facilities = sa.table(
    "production_facilities",
    sa.column("code", sa.Text),
    sa.column("data", postgresql.JSONB),
)


def upgrade() -> None:
    seed = yaml.safe_load(SEED.read_text(encoding="utf-8"))
    bind = op.get_bind()
    bind.execute(
        postgresql.insert(master_records).on_conflict_do_nothing(index_elements=["kind", "code"]),
        [
            {"kind": kind, "code": entry[CODE_FIELD[kind]], "data": entry}
            for kind, entries in seed.items()
            if kind != "facilities"
            for entry in entries
        ],
    )
    bind.execute(
        postgresql.insert(facilities).on_conflict_do_nothing(index_elements=["code"]),
        [{"code": entry[CODE_FIELD["facilities"]], "data": entry} for entry in seed["facilities"]],
    )


def downgrade() -> None:
    # No-op: rows may have been edited by admins, so they cannot be told apart from seed data.
    pass
