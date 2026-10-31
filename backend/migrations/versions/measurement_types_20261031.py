"""Shared tailor measurement catalog, backfilled from existing product configurations."""

import unicodedata

import sqlalchemy as sa
from alembic import op

revision = "measurement_types_20261031"
down_revision = "step_mode_20261031"
branch_labels = None
depends_on = None


def _normalize(label: str) -> str:
    return " ".join(unicodedata.normalize("NFC", label).split()).casefold()


def upgrade():
    op.create_table(
        "measurement_types",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("key", sa.Text(), nullable=False, unique=True),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("normalized_label", sa.Text(), nullable=False, unique=True),
    )
    connection = op.get_bind()
    labels_by_key: dict[str, dict[str, str]] = {}
    keys_by_name: dict[str, set[str]] = {}
    for (fields,) in connection.execute(sa.text("SELECT tailor_measurements FROM products")):
        for field in fields:
            label = " ".join(field["label"].split())
            labels_by_key.setdefault(field["key"], {}).setdefault(_normalize(label), label)
            keys_by_name.setdefault(_normalize(label), set()).add(field["key"])
    conflicts = [f"key {k}: {sorted(v.values())}" for k, v in labels_by_key.items() if len(v) > 1]
    conflicts += [f"name {n!r}: keys {sorted(k)}" for n, k in keys_by_name.items() if len(k) > 1]
    if conflicts:
        # Merging by guess could change what a measurement means; a person must resolve these.
        raise RuntimeError(
            "Measurement catalog backfill stopped, resolve these product configurations first: "
            + "; ".join(sorted(conflicts))
        )
    for key, names in labels_by_key.items():
        ((normalized, label),) = names.items()
        connection.execute(
            sa.text(
                "INSERT INTO measurement_types (key, label, normalized_label)"
                " VALUES (:key, :label, :normalized)"
            ),
            {"key": key, "label": label, "normalized": normalized},
        )


def downgrade():
    op.drop_table("measurement_types")
