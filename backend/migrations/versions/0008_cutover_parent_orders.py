"""Cut parent size choices over to orders; keep the old table as legacy_parent_size_choices."""

import json
import os
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

SCHOOL_CODE = os.environ.get("CUTOVER_SCHOOL_CODE", "LQD")
ACTOR = "system:colour-policy"
COLOUR = "ghi"
PRODUCT_CODES = ("blazer", "gile")


def _audit(
    bind: sa.Connection, action: str, entity: str, entity_id: object, before: object, after: object
) -> None:
    bind.execute(
        sa.text(
            "INSERT INTO audit_logs (actor, action, entity, entity_id, before, after) "
            "VALUES (:actor, :action, :entity, :entity_id, "
            "CAST(:before AS jsonb), CAST(:after AS jsonb))"
        ),
        {
            "actor": ACTOR,
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "before": None if before is None else json.dumps(before),
            "after": None if after is None else json.dumps(after),
        },
    )


def _open_campaign(bind: sa.Connection, school_id: object, products: dict[str, object]) -> object:
    campaign_id = bind.scalar(
        sa.text("SELECT id FROM campaigns WHERE school_id = :s AND status = 'OPEN'"),
        {"s": school_id},
    )
    if campaign_id is None:
        now = datetime.now(UTC)
        start = now.year if now.month >= 8 else now.year - 1
        year = f"{start}-{start + 1}"
        campaign_id = bind.scalar(
            sa.text(
                "INSERT INTO campaigns (school_id, name, school_year, opens_at, status) "
                "VALUES (:s, :name, :year, now(), 'OPEN') RETURNING id"
            ),
            {"s": school_id, "name": f"Đồng phục {year}", "year": year},
        )
        _audit(
            bind, "campaign.create", "campaign", campaign_id, None,
            {"school_id": str(school_id), "name": f"Đồng phục {year}", "status": "OPEN"},
        )  # fmt: skip
    present = {
        row[0]
        for row in bind.execute(
            sa.text("SELECT product_id FROM campaign_items WHERE campaign_id = :c"),
            {"c": campaign_id},
        )
    }
    for sort, (code, product_id) in enumerate(products.items()):
        if product_id in present:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO campaign_items (campaign_id, product_id, unit_price, colour, sort) "
                "VALUES (:c, :p, NULL, :colour, :sort)"
            ),
            {"c": campaign_id, "p": product_id, "colour": COLOUR, "sort": sort},
        )
        _audit(
            bind, "campaign.items.replace", "campaign", campaign_id, None,
            {"product": code, "unit_price": None, "colour": COLOUR},
        )  # fmt: skip
    return campaign_id


def _convert_choices(
    bind: sa.Connection, school_id: object, campaign_id: object, products: dict[str, object]
) -> int:
    by_id = {pid: code for code, pid in products.items()}
    students = bind.execute(
        sa.text(
            "SELECT s.id, s.full_name, s.gender, s.parent_name, s.parent_phone, c.name "
            "FROM students s JOIN school_classes c ON c.id = s.class_id "
            "WHERE s.school_id = :school AND s.deleted_at IS NULL "
            "AND EXISTS (SELECT 1 FROM parent_size_choices p WHERE p.student_id = s.id) "
            "ORDER BY s.created_at, s.id"
        ),
        {"school": school_id},
    ).all()
    converted = 0
    for student_id, full_name, gender, parent_name, parent_phone, class_name in students:
        if bind.scalar(
            sa.text(
                "SELECT 1 FROM orders "
                "WHERE campaign_id = :c AND student_id = :s AND deleted_at IS NULL"
            ),
            {"c": campaign_id, "s": student_id},
        ):
            continue
        choices = [
            row
            for row in bind.execute(
                sa.text(
                    "SELECT product_id, size_label, colour, chosen_at FROM parent_size_choices "
                    "WHERE student_id = :s ORDER BY chosen_at, id"
                ),
                {"s": student_id},
            )
            if row[0] in by_id
        ]
        if not choices:
            continue
        seq = bind.scalar(sa.text("SELECT nextval('order_code_seq')"))
        code = f"GB{SCHOOL_CODE}{datetime.now(UTC):%y%m%d}_{seq:05d}"
        order_id = bind.scalar(
            sa.text(
                "INSERT INTO orders (campaign_id, code, student_id, recipient_name, parent_name, "
                "parent_phone, gender, class_label, source, status, submitted_at) "
                "VALUES (:c, :code, :s, :name, :pn, :pp, :g, :cl, 'PARENT', 'SUBMITTED', :at) "
                "RETURNING id"
            ),
            {
                "c": campaign_id,
                "code": code,
                "s": student_id,
                "name": full_name,
                "pn": parent_name,
                "pp": parent_phone,
                "g": gender,
                "cl": class_name,
                "at": max(row[3] for row in choices),
            },
        )
        for product_id, size_label, _, _ in choices:
            bind.execute(
                sa.text(
                    "INSERT INTO order_lines "
                    "(order_id, product_id, size_label, colour, qty, unit_price) "
                    "VALUES (:o, :p, :size, :colour, 1, NULL)"
                ),
                {"o": order_id, "p": product_id, "size": size_label, "colour": COLOUR},
            )
        _audit(
            bind, "order.create", "order", order_id,
            {"colours": {by_id[row[0]]: row[2] for row in choices}},
            {
                "code": code,
                "status": "SUBMITTED",
                "source": "PARENT",
                "lines": [
                    {"product": by_id[row[0]], "size_label": row[1], "colour": COLOUR, "qty": 1}
                    for row in choices
                ],
            },
        )  # fmt: skip
        converted += 1
    return converted


def upgrade() -> None:
    bind = op.get_bind()
    school_id = bind.scalar(sa.text("SELECT id FROM schools WHERE code = :c"), {"c": SCHOOL_CODE})
    converted = 0
    existing = bind.scalar(sa.text("SELECT count(*) FROM parent_size_choices"))
    if school_id is not None:
        products = {
            code: pid
            for code, pid in bind.execute(
                sa.text("SELECT code, id FROM products WHERE code = ANY(:codes)"),
                {"codes": list(PRODUCT_CODES)},
            )
        }
        if set(products) == set(PRODUCT_CODES):
            ordered = {code: products[code] for code in PRODUCT_CODES}
            campaign_id = _open_campaign(bind, school_id, ordered)
            converted = _convert_choices(bind, school_id, campaign_id, ordered)
        elif existing:
            raise RuntimeError(f"0008: products {PRODUCT_CODES} missing, cannot convert choices")
    elif existing:
        raise RuntimeError(
            f"0008: {existing} parent size choices exist but no school has code {SCHOOL_CODE!r}; "
            "set CUTOVER_SCHOOL_CODE to the Le Quy Don school code"
        )
    outside = bind.scalar(
        sa.text(
            "SELECT count(*) FROM parent_size_choices p JOIN students s ON s.id = p.student_id "
            "WHERE s.school_id IS DISTINCT FROM CAST(:school AS uuid)"
        ),
        {"school": school_id},
    )
    print(f"0008: converted {converted} {SCHOOL_CODE} orders")
    print(f"0008: {outside} parent size choices outside {SCHOOL_CODE} were not converted")
    op.drop_constraint("ck_parent_size_choices_colour", "parent_size_choices")
    op.rename_table("parent_size_choices", "legacy_parent_size_choices")


def downgrade() -> None:
    op.rename_table("legacy_parent_size_choices", "parent_size_choices")
    op.create_check_constraint(
        "ck_parent_size_choices_colour", "parent_size_choices", "colour IN ('navy', 'ghi')"
    )
