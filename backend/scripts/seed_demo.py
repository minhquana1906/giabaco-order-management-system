"""Load varied synthetic demo data into a local dev database.

Usage (cwd: backend/): uv run python -m scripts.seed_demo
Runs through the real handlers, so audit logs, portal tokens and suggested sizes are populated.
Deterministic. Students are skipped if any exist; each school without a campaign gets one
OPEN campaign. Refuses non-local databases.
"""

import asyncio
import random
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record
from app.core.config import get_settings
from app.core.db import SessionLocal, engine
from app.features.campaigns.handler import create_campaign, replace_items, transition
from app.features.campaigns.models import Campaign
from app.features.campaigns.schemas import CampaignIn, ItemIn, ItemsIn
from app.features.catalog.handler import create_class, create_school, list_classes, list_schools
from app.features.catalog.models import Product, School
from app.features.catalog.schemas import ClassIn, SchoolIn
from app.features.master_data.models import Facility
from app.features.orders.models import SUBMITTED, Order, OrderLine
from app.features.production.models import Assignment, CampaignStep
from app.features.production.router import DEFAULT_NAMES, record_progress, snapshot
from app.features.students.handler import create_student, delete_student
from app.features.students.models import Fit, Student
from app.features.students.schemas import StudentIn, TrialIn

ACTOR = "seed"
SEED = 20261018
REFERENCE_DATE = date(2026, 10, 18)
INTERNAL_ASSIGNEES = {1: "Phòng Kinh doanh", 2: "Phòng Thiết kế"}
INTERNAL_STEPS = INTERNAL_ASSIGNEES.keys()
LOCAL_HOSTS = {"127.0.0.1", "localhost"}

SCHOOLS: dict[tuple[str, str], list[tuple[int, str]]] = {
    ("Tiểu học Lê Quý Đôn", "LQD"): [(1, "1A1"), (2, "2A1"), (3, "3A2"), (4, "4A1"), (5, "5A1")],
    ("THCS Nguyễn Du", "NDU"): [(6, "6A1"), (6, "6A2"), (7, "7A1"), (9, "9A3")],
}
HEIGHT_BY_GRADE = {1: 117, 2: 123, 3: 130, 4: 137, 5: 144, 6: 151, 7: 158, 9: 168}
HEIGHT_SD = 5.5
SIZE_HEIGHT_BOUNDS = (120, 130, 140, 150, 160, 165)

FAMILY = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương"]
MIDDLE_M = ["Văn", "Minh", "Quốc", "Gia", "Đức", "Anh"]
MIDDLE_F = ["Thị", "Ngọc", "Khánh", "Bảo", "Thu", "Mai"]
GIVEN_M = ["Hùng", "Khôi", "Nam", "Phúc", "Long", "Bách", "Huy", "Tuấn", "Đạt", "Kiên"]
GIVEN_F = ["Linh", "Anh", "Chi", "Hà", "Vy", "Trang", "Ngân", "Lan", "My", "Thảo"]
NOTES = [
    "Vai chật khi giơ tay",
    "Tay áo hơi ngắn",
    "Thân áo rộng, cần chỉnh",
    "Bé đang tuổi lớn, phụ huynh muốn chọn rộng",
    "Cài nút bụng hơi căng",
]


def _size_index(height: float, count: int) -> int:
    return min(sum(height >= bound for bound in SIZE_HEIGHT_BOUNDS), count - 1)


def _trials(rng: random.Random, products: list[Product], height: float) -> list[TrialIn]:
    """Pick 0-3 tried sizes around a noisy 'true' size per product, labelled by distance."""
    trials: list[TrialIn] = []
    for product in products:
        if rng.random() > (0.9 if product.code == "blazer" else 0.7):
            continue
        last = len(product.sizes) - 1
        true_idx = min(
            max(_size_index(height, len(product.sizes)) + rng.choice([-1, 0, 0, 0, 1]), 0), last
        )
        candidates = [i for i in (true_idx - 1, true_idx, true_idx + 1) if 0 <= i <= last]
        for idx in sorted(rng.sample(candidates, k=rng.randint(1, len(candidates)))):
            fit = (
                Fit.TOO_TIGHT if idx < true_idx else Fit.FITS if idx == true_idx else Fit.TOO_LOOSE
            )
            note = rng.choice(NOTES) if rng.random() < 0.2 else None
            trials.append(
                TrialIn(
                    product_code=product.code, size_label=product.sizes[idx], fit=fit, note=note
                )
            )
    return trials


def _random_students(
    rng: random.Random, products: list[Product], refs: list[tuple[Any, Any, int]]
) -> list[StudentIn]:
    students: list[StudentIn] = []
    for school, school_class, grade in refs:
        for _ in range(rng.randint(5, 8)):
            male = rng.random() < 0.5
            name = " ".join(
                [
                    rng.choice(FAMILY),
                    rng.choice(MIDDLE_M if male else MIDDLE_F),
                    rng.choice(GIVEN_M if male else GIVEN_F),
                ]
            )
            height = round(min(max(rng.gauss(HEIGHT_BY_GRADE[grade], HEIGHT_SD), 95.0), 188.0), 1)
            weight = round(min(max(height * rng.uniform(0.17, 0.30) - 5, 12.0), 85.0), 1)
            age_days = (grade + 5) * 365 + rng.randint(0, 364)
            has_parent = rng.random() < 0.8
            students.append(
                StudentIn(
                    school_id=school.id,
                    class_id=school_class.id,
                    full_name=name,
                    dob=REFERENCE_DATE - timedelta(days=age_days),
                    gender="MALE" if male else "FEMALE",
                    height_cm=Decimal(str(height)),
                    weight_kg=Decimal(str(weight)),
                    parent_name=f"{rng.choice(FAMILY)} {rng.choice(GIVEN_M + GIVEN_F)}"
                    if has_parent
                    else None,
                    parent_phone=f"09{rng.randint(10_000_000, 99_999_999)}" if has_parent else None,
                    parent_email=f"phuhuynh{rng.randint(100, 999)}@example.com"
                    if has_parent and rng.random() < 0.4
                    else None,
                    trials=_trials(rng, products, height),
                )
            )
    return students


def _edge_cases(school: Any, school_class: Any) -> list[StudentIn]:
    """Hand-written boundary and sparse cases that random generation rarely hits.

    In order: exact size-guide boundary, below the guide, above the guide, no trials, gile-only
    trial with parent phone, several fitting sizes of one product, and a student soft-deleted last.
    """

    def student(name: str, dob: date, height: str, weight: str, **extra: Any) -> StudentIn:
        return StudentIn(
            school_id=school.id, class_id=school_class.id, full_name=name, dob=dob, gender="MALE",
            height_cm=Decimal(height), weight_kg=Decimal(weight), **extra,
        )  # fmt: skip

    return [
        student(
            "Nguyễn Hoàng Minh",
            date(2018, 3, 1),
            "120.0",
            "18.0",
            trials=[TrialIn(product_code="blazer", size_label="2", fit=Fit.FITS)],
        ),
        student(
            "Trần Gia Bảo",
            date(2020, 5, 9),
            "95.0",
            "12.0",
            trials=[
                TrialIn(product_code="blazer", size_label="1", fit=Fit.TOO_LOOSE, note="Quá rộng")
            ],
        ),
        student(
            "Lê Đức Anh",
            date(2011, 1, 30),
            "190.0",
            "90.0",
            trials=[TrialIn(product_code="blazer", size_label="7", fit=Fit.TOO_TIGHT)],
        ),
        student("Phạm Ngọc Khánh", date(2016, 8, 14), "135.0", "28.0"),
        student(
            "Hoàng Thu Trang",
            date(2015, 2, 2),
            "141.5",
            "34.0",
            parent_phone="+84912345678",
            trials=[TrialIn(product_code="gile", size_label="4", fit=Fit.FITS)],
        ),
        student(
            "Vũ Minh Quân",
            date(2014, 7, 21),
            "148.0",
            "36.0",
            parent_name="Nguyễn Thị Mai",
            trials=[
                TrialIn(product_code="blazer", size_label="4", fit=Fit.FITS),
                TrialIn(product_code="blazer", size_label="5", fit=Fit.FITS, note="Vừa, rộng thêm"),
                TrialIn(product_code="blazer", size_label="6", fit=Fit.TOO_LOOSE),
            ],
        ),
        student(
            "Đặng Bảo Ngọc",
            date(2015, 11, 11),
            "138.0",
            "30.0",
            trials=[TrialIn(product_code="gile", size_label="3", fit=Fit.FITS)],
        ),
    ]


async def _ensure_catalog(session: AsyncSession) -> list[tuple[Any, Any, int]]:
    refs: list[tuple[Any, Any, int]] = []
    existing_schools = {s.code: s for s in await list_schools(session)}
    for (name, code), classes in SCHOOLS.items():
        school = existing_schools.get(code) or await create_school(
            session, SchoolIn(name=name, code=code, grades=sorted({g for g, _ in classes}))
        )
        existing = {c.name: c for c in await list_classes(session, school.id)}
        for grade, class_name in classes:
            school_class = existing.get(class_name) or await create_class(
                session, school.id, ClassIn(grade=grade, name=class_name)
            )
            refs.append((school, school_class, grade))
    return refs


async def _ensure_campaigns(session: AsyncSession, products: list[Product]) -> None:
    items = ItemsIn(
        items=[
            ItemIn(product_id=p.id, colour=p.colours[0], sort=index)
            for index, p in enumerate(products)
        ]
    )
    for school in await list_schools(session):
        if await session.scalar(select(Campaign.id).where(Campaign.school_id == school.id)):
            continue
        campaign = await create_campaign(
            session,
            CampaignIn(
                school_id=school.id, name="Đợt đồng phục 2026-2027", school_year="2026-2027"
            ),
            ACTOR,
        )
        await replace_items(session, campaign.id, items, ACTOR)
        if school.code == "LQD":
            await transition(session, campaign.id, "open", ACTOR)


async def _ensure_production(session: AsyncSession, products: list[Product]) -> None:
    """Timeline deadlines and partner assignments for the LQD campaign; skipped once any exist."""
    campaign = await session.scalar(
        select(Campaign)
        .join(School, School.id == Campaign.school_id)
        .where(School.code == "LQD")
        .order_by(Campaign.created_at)
    )
    if not campaign or await session.scalar(
        select(Assignment.id).where(Assignment.campaign_id == campaign.id).limit(1)
    ):
        return
    facilities = list((await session.scalars(select(Facility).order_by(Facility.code))).all())
    facilities = [f for f in facilities if f.active][:3]
    for number in range(len(facilities), 3):
        facility = Facility(
            code=f"GUF-DEMO-{number + 1}",
            data={
                "Mã cơ sở": f"GUF-DEMO-{number + 1}",
                "Tên cơ sở/đối tác": f"Đối tác demo {number + 1}",
                "Trạng thái hợp tác": "Đang sử dụng",
            },
        )
        session.add(facility)
        facilities.append(facility)
    await session.flush()
    steps = {
        step.position: step
        for step in await session.scalars(
            select(CampaignStep).where(CampaignStep.campaign_id == campaign.id)
        )
    }
    for position, name in enumerate(DEFAULT_NAMES, 1):
        step = steps.get(position)
        if step is None:
            step = CampaignStep(
                campaign_id=campaign.id,
                position=position,
                name=name,
                deadline=REFERENCE_DATE + timedelta(days=7 * position),
            )
            session.add(step)
        if position in INTERNAL_STEPS and step.mode != "internal":
            before_mode = step.mode or "partners"
            step.mode = "internal"
            await record(
                session,
                ACTOR,
                "update",
                "production_timeline",
                campaign.id,
                {"position": position, "mode": before_mode},
                {"position": position, "mode": "internal"},
            )
    await session.commit()
    blazer, gile = (next(p for p in products if p.code == code) for code in ("blazer", "gile"))
    first, second, third = facilities
    ordered = {
        pid: int(qty)
        for pid, qty in await session.execute(
            select(OrderLine.product_id, func.sum(OrderLine.qty))
            .join(Order, Order.id == OrderLine.order_id)
            .where(
                Order.campaign_id == campaign.id,
                Order.status == SUBMITTED,
                Order.deleted_at.is_(None),
            )
            .group_by(OrderLine.product_id)
        )
    }
    blazer_total, gile_total = ordered.get(blazer.id, 0), ordered.get(gile.id, 0)
    blazer_first = blazer_total * 6 // 10 or 60
    blazer_second = blazer_total - blazer_first if blazer_total else 40
    gile_part = gile_total // 2 or 100
    plan: list[tuple[int, Facility | None, Product | None, int | None, str]] = [
        (1, None, None, None, "completed"),
        (2, None, None, None, "completed"),
        (4, first, None, None, "completed"),
        (6, first, blazer, blazer_first, "in_progress"),
        (6, second, blazer, blazer_second, "pending"),
        (6, third, gile, gile_part, "in_progress"),
        (7, second, None, None, "pending"),
        (8, third, None, None, "pending"),
        (9, first, None, None, "pending"),
    ]
    for position, partner, product, quantity, status in plan:
        row = Assignment(
            campaign_id=campaign.id,
            step_position=position,
            facility_id=partner.id if partner else None,
            assignee=INTERNAL_ASSIGNEES.get(position) if partner is None else None,
            product_id=product.id if product else None,
            quantity=quantity,
        )
        session.add(row)
        await session.flush()
        created = snapshot(row)
        await record(session, ACTOR, "create", "production_assignment", row.id, None, created)
        if status != "pending":
            row.status = status
            if status == "completed":
                row.actual_at = datetime.combine(REFERENCE_DATE, time(10), UTC)
            await record_progress(session, ACTOR, row.id, created, snapshot(row))
        await session.commit()
    await session.commit()


async def main() -> None:
    host = urlparse(get_settings().database_url).hostname
    if host not in LOCAL_HOSTS:
        raise SystemExit(f"Refusing to seed demo data into non-local database host {host!r}")
    async with SessionLocal() as session:
        products = list(
            (
                await session.scalars(
                    select(Product).where(Product.active).order_by(Product.position)
                )
            ).all()
        )
        if not {"blazer", "gile"} <= {p.code for p in products}:
            raise SystemExit("Catalog missing blazer/gile; run `make setup` first")
        refs = await _ensure_catalog(session)
        await _ensure_campaigns(session, products)
        await _ensure_production(session, products)
        if await session.scalar(select(func.count()).select_from(Student)):
            print("students already exist, skipping student seed")
            return
        rng = random.Random(SEED)
        payloads = _random_students(rng, products, refs) + _edge_cases(refs[-1][0], refs[-1][1])
        ids = [await create_student(session, p, ACTOR) for p in payloads]
        deleted = ids.pop()
        await delete_student(session, deleted, ACTOR)
    await engine.dispose()
    trials = sum(len(p.trials) for p in payloads[:-1])
    print(f"seeded {len(ids)} students ({trials} trials), 1 soft-deleted")


if __name__ == "__main__":
    asyncio.run(main())
