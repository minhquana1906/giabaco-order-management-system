"""Public survey API schemas."""

import unicodedata
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import (
    AfterValidator,
    BaseModel,
    Field,
    ValidationInfo,
    field_validator,
)
from pydantic_core import PydanticCustomError

from app.core.phone import normalize_phone
from app.core.text import reject_control_chars
from app.features.students.models import HEIGHT_RANGE, WEIGHT_RANGE, Gender
from app.features.surveys.models import (
    CHEST_RANGE,
    HIP_RANGE,
    WAIST_RANGE,
    BodyTrait,
    FitPreference,
    MeasureMethod,
    PastIssue,
    SupplyOption,
)


def _vn_today() -> date:
    # Parents submit in UTC+7 while the server runs on UTC.
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()


MAX_MEASUREMENT_AGE_DAYS = 180


def _name(value: str) -> str:
    value = unicodedata.normalize("NFC", " ".join(reject_control_chars(value).split()))
    if not value:
        raise PydanticCustomError("blank", "Vui lòng nhập thông tin này.")
    return value


def _length(lo: int, hi: int, digits: int = 4) -> object:
    return Field(ge=lo, le=hi, max_digits=digits, decimal_places=1)


Height = Annotated[Decimal, _length(*HEIGHT_RANGE)]
Weight = Annotated[
    Decimal, Field(ge=WEIGHT_RANGE[0], le=WEIGHT_RANGE[1], max_digits=3, decimal_places=1)
]
Chest = Annotated[Decimal, _length(*CHEST_RANGE)]
Waist = Annotated[Decimal, _length(*WAIST_RANGE)]
Hip = Annotated[Decimal, _length(*HIP_RANGE)]


class SurveyIn(BaseModel):
    school_name: Annotated[str, Field(min_length=1, max_length=200), AfterValidator(_name)]
    province: Annotated[str, Field(min_length=1, max_length=100), AfterValidator(_name)]
    ward: Annotated[str, Field(min_length=1, max_length=100), AfterValidator(_name)]
    class_name: Annotated[str, Field(min_length=1, max_length=50), AfterValidator(_name)]
    child_full_name: Annotated[str, Field(min_length=1, max_length=200), AfterValidator(_name)]
    dob: date
    gender: Gender
    parent_phone: Annotated[str, Field(max_length=30), AfterValidator(normalize_phone)]
    measured_on: date
    measure_method: MeasureMethod
    height_cm: Height
    weight_kg: Weight
    chest_cm: Chest | None = None
    waist_cm: Waist | None = None
    hip_cm: Hip | None = None
    body_traits: list[BodyTrait] = Field(default_factory=list, max_length=len(BodyTrait))
    fit_preference: FitPreference | None = None
    past_issues: list[PastIssue] = Field(default_factory=list, max_length=len(PastIssue))
    supply_option: SupplyOption

    @field_validator("dob")
    @classmethod
    def _dob(cls, v: date) -> date:
        today = _vn_today()
        if v >= today or v.year < today.year - 25:
            raise PydanticCustomError(
                "invalid_dob", "Ngày sinh chưa hợp lệ. Vui lòng chọn lại ngày, tháng, năm sinh."
            )
        return v

    @field_validator("measured_on")
    @classmethod
    def _measured_on(cls, v: date, info: ValidationInfo) -> date:
        today = _vn_today()
        if v > today:
            raise PydanticCustomError(
                "future_measured_on", "Ngày đo không được sau hôm nay. Vui lòng chọn lại."
            )
        if v < today - timedelta(days=MAX_MEASUREMENT_AGE_DAYS):
            raise PydanticCustomError(
                "stale_measurement", "Số đo đã cũ hơn 6 tháng, vui lòng đo lại cho học sinh."
            )
        dob = info.data.get("dob")
        if dob is not None and v <= dob:
            raise PydanticCustomError("measured_before_dob", "Ngày đo phải sau ngày sinh.")
        return v

    @field_validator("body_traits", "past_issues")
    @classmethod
    def _unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise PydanticCustomError(
                "duplicate_choice", "Mỗi lựa chọn chỉ chọn một lần. Vui lòng bỏ mục bị trùng."
            )
        return v


class SurveyCreated(BaseModel):
    id: uuid.UUID
