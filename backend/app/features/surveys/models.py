"""Parent measurement survey responses; rows are immutable (DB trigger blocks UPDATE)."""

import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

FORM_VERSION = "2026-10"
CHEST_RANGE = (40, 140)
WAIST_RANGE = (35, 140)
HIP_RANGE = (40, 150)


class SchoolArea(enum.StrEnum):
    URBAN = "URBAN"
    RURAL = "RURAL"


class MeasureMethod(enum.StrEnum):
    TAPE_TODAY = "TAPE_TODAY"
    RECENT_RECORD = "RECENT_RECORD"
    ESTIMATE = "ESTIMATE"


class BodyTrait(enum.StrEnum):
    NORMAL = "NORMAL"
    ROUND_BELLY = "ROUND_BELLY"
    TALL_SLIM = "TALL_SLIM"
    BROAD_SHOULDERS = "BROAD_SHOULDERS"


class FitPreference(enum.StrEnum):
    SLIM = "SLIM"
    REGULAR = "REGULAR"
    LOOSE = "LOOSE"


class PastIssue(enum.StrEnum):
    ITCHY_FABRIC = "ITCHY_FABRIC"
    HOT_WRINKLE_PILLING = "HOT_WRINKLE_PILLING"
    CROTCH_FIT = "CROTCH_FIT"
    NO_FITTING_SIZE = "NO_FITTING_SIZE"


class SupplyOption(enum.StrEnum):
    STANDARD = "STANDARD"
    TAILOR = "TAILOR"


def area_of_ward(ward: str) -> SchoolArea:
    """Phường is urban; Xã and Đặc khu are rural."""
    return SchoolArea.URBAN if ward.startswith("Phường") else SchoolArea.RURAL


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    form_version: Mapped[str] = mapped_column(String(20))
    school_name: Mapped[str] = mapped_column(Text)
    province: Mapped[str] = mapped_column(Text)
    ward: Mapped[str] = mapped_column(Text)
    school_area: Mapped[str] = mapped_column(String(10))
    class_name: Mapped[str] = mapped_column(Text)
    child_full_name: Mapped[str] = mapped_column(Text)
    dob: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(10))
    parent_phone: Mapped[str] = mapped_column(Text)
    measured_on: Mapped[date] = mapped_column(Date)
    measure_method: Mapped[str] = mapped_column(String(20))
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    chest_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    waist_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    hip_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    body_traits: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    fit_preference: Mapped[str | None] = mapped_column(String(10))
    past_issues: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    supply_option: Mapped[str] = mapped_column(String(10))
