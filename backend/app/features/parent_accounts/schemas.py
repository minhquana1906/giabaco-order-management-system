"""Parent account API schemas."""

import re
import unicodedata
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.core.phone import normalize_phone
from app.core.text import reject_control_chars
from app.features.students.models import HEIGHT_RANGE, WEIGHT_RANGE, DataSource, Gender

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _non_blank_name(value: str) -> str:
    value = unicodedata.normalize("NFC", reject_control_chars(value.strip()))
    if not value:
        raise ValueError("Không được để trống")
    return value


FullName = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(_non_blank_name)]


def _optional_email(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = reject_control_chars(value.strip().lower())
    if not _EMAIL_RE.match(value):
        raise ValueError("Email không hợp lệ")
    return value


OptionalEmail = Annotated[str | None, Field(max_length=200), AfterValidator(_optional_email)]
Phone = Annotated[str, AfterValidator(normalize_phone)]
Password = Annotated[str, Field(max_length=128), AfterValidator(reject_control_chars)]
Identifier = Annotated[str, Field(max_length=200), AfterValidator(reject_control_chars)]


Height = Annotated[
    Decimal, Field(ge=HEIGHT_RANGE[0], le=HEIGHT_RANGE[1], max_digits=4, decimal_places=1)
]
Weight = Annotated[
    Decimal, Field(ge=WEIGHT_RANGE[0], le=WEIGHT_RANGE[1], max_digits=3, decimal_places=1)
]


class RegisterIn(BaseModel):
    full_name: FullName
    phone: Phone
    email: OptionalEmail = None
    password: Annotated[Password, Field(min_length=8)]


class LoginIn(BaseModel):
    identifier: Identifier
    password: Password


class ParentAccountOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None


class ChildKeyIn(BaseModel):
    """The three facts a parent must know to find a child's record."""

    school_id: uuid.UUID
    full_name: FullName
    dob: date


class LookupOut(BaseModel):
    found: bool
    ambiguous: bool | None = None
    full_name: str | None = None
    school_name: str | None = None
    class_name: str | None = None


class OrderSummary(BaseModel):
    items: int
    amount: int
    has_unpriced: bool
    status: str


class ChildSummary(BaseModel):
    student_id: uuid.UUID
    full_name: str
    school_id: uuid.UUID
    school_name: str
    class_id: uuid.UUID
    class_name: str
    gender: Gender
    data_source: DataSource
    parent_name: str | None
    parent_phone: str | None
    parent_email: str | None
    order_summary: OrderSummary | None
    campaign_open: bool


class ChildUpdateIn(BaseModel):
    """The fields a parent may change on a self-declared record."""

    class_id: uuid.UUID
    gender: Gender
    height_cm: Height
    weight_kg: Weight


class ChildIn(ChildKeyIn, ChildUpdateIn):
    @field_validator("dob")
    @classmethod
    def _dob(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("Ngày sinh phải trong quá khứ")
        return v


class SchoolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    school_id: uuid.UUID
    grade: int
    name: str
