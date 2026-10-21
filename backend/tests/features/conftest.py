import secrets
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.campaigns.models import (
    OPEN,
    Campaign,
    CampaignItem,
    CampaignKit,
    KitSlot,
    KitSlotOption,
)
from app.features.catalog.models import School, SchoolClass
from app.features.students.models import DataSource, Fit, FittingTrial, Gender, Student

TrialSpec = tuple[str, str, str, str | None]
MakeStudent = Callable[..., Awaitable[Student]]
MakeClass = Callable[..., Awaitable[SchoolClass]]
OpenCampaign = Callable[..., Awaitable[Campaign]]


@pytest.fixture
def make_class(session: AsyncSession, school_class: dict[str, Any]) -> MakeClass:
    """Create an extra class, by default in the fixture school."""

    async def make(grade: int, name: str, school_id: Any = None) -> SchoolClass:
        klass = SchoolClass(
            school_id=school_id or uuid.UUID(str(school_class["school_id"])), grade=grade, name=name
        )
        session.add(klass)
        await session.commit()
        return klass

    return make


@pytest.fixture
def make_student(
    session: AsyncSession, school_class: dict[str, Any], products: dict[str, Any]
) -> MakeStudent:
    """Insert a student with trials given as (product_code, size, fit, suggested) tuples."""

    async def make(
        full_name: str = "Nguyễn Minh Khang",
        trials: list[TrialSpec] | None = None,
        *,
        school_id: Any = None,
        class_id: Any = None,
        gender: Gender = Gender.MALE,
        dob: date = date(2018, 3, 14),
        height_cm: float = 126.5,
        weight_kg: float = 24.0,
        measured_at: datetime = datetime(2026, 3, 14, 9, 0, tzinfo=UTC),
        note: str | None = None,
        deleted: bool = False,
        deleted_trials: list[TrialSpec] | None = None,
        data_source: DataSource = DataSource.ADMIN_MEASURED,
    ) -> Student:
        student = Student(
            school_id=school_id or uuid.UUID(str(school_class["school_id"])),
            class_id=class_id or uuid.UUID(str(school_class["class_id"])),
            full_name=full_name,
            dob=dob,
            gender=gender,
            height_cm=height_cm,
            weight_kg=weight_kg,
            parent_name="Trần Thị Hoa",
            parent_phone="0912345678",
            parent_email="hoa@example.com",
            portal_token=secrets.token_urlsafe(16),
            measured_at=measured_at,
            deleted_at=datetime.now(UTC) if deleted else None,
            data_source=data_source,
        )
        session.add(student)
        await session.flush()
        specs = [(t, False) for t in trials or []] + [(t, True) for t in deleted_trials or []]
        for i, ((code, size, fit, suggested), is_deleted) in enumerate(specs):
            session.add(
                FittingTrial(
                    student_id=student.id,
                    product_id=products[code].id,
                    size_label=size,
                    suggested_size_label=suggested,
                    fit=Fit(fit),
                    note=note if i == 0 else None,
                    tried_at=measured_at + timedelta(minutes=i),
                    deleted_at=datetime.now(UTC) if is_deleted else None,
                )
            )
        await session.commit()
        return student

    return make


@pytest.fixture
def make_school(session: AsyncSession) -> Callable[[str, str], Awaitable[School]]:
    """Create an additional school."""

    async def make(name: str, code: str) -> School:
        school = School(name=name, code=code)
        session.add(school)
        await session.commit()
        return school

    return make


@pytest.fixture
def open_campaign(session: AsyncSession, products: dict[str, Any]) -> OpenCampaign:
    """Campaign with a priced blazer, an unpriced gile and one kit of both, all colour ghi."""

    async def make(school_id: Any, status: str = OPEN) -> Campaign:
        blazer, gile = products["blazer"].id, products["gile"].id
        campaign = Campaign(
            school_id=uuid.UUID(str(school_id)),
            name="Đợt đồng phục",
            school_year="2026-2027",
            opens_at=datetime.now(UTC) - timedelta(days=1),
            status=status,
        )
        campaign.items = [
            CampaignItem(product_id=blazer, unit_price=500_000, colour="ghi", sort=0),
            CampaignItem(product_id=gile, unit_price=None, colour="ghi", sort=1),
        ]
        kit = CampaignKit(code="bo", name="Bộ Blazer và Gile", sort=0)
        kit.slots = [
            KitSlot(label="Blazer", qty=1, sort=0, options=[KitSlotOption(product_id=blazer)]),
            KitSlot(label="Gile", qty=1, sort=1, options=[KitSlotOption(product_id=gile)]),
        ]
        campaign.kits = [kit]
        session.add(campaign)
        await session.commit()
        return campaign

    return make
