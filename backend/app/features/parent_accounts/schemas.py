"""Parent account API schemas."""

import re
import unicodedata
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from app.core.phone import normalize_phone
from app.core.text import reject_control_chars
from app.features.students.models import HEIGHT_RANGE, WEIGHT_RANGE, DataSource, Gender

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _non_blank_name(value: str) -> str:
    value = unicodedata.normalize("NFC", reject_control_chars(value.strip()))
    if not value:
        raise PydanticCustomError("blank", "Vui lòng nhập thông tin này.")
    return value


FullName = Annotated[str, Field(min_length=1, max_length=200), AfterValidator(_non_blank_name)]


def _email(value: str) -> str:
    value = reject_control_chars(value.strip().lower())
    if not _EMAIL_RE.match(value):
        raise PydanticCustomError("invalid_email", "Email chưa đúng. Ví dụ: ten@gmail.com.")
    return value


Email = Annotated[str, Field(max_length=200), AfterValidator(_email)]
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
    email: Email
    password: Annotated[Password, Field(min_length=8)]


class ForgotIn(BaseModel):
    email: Email


class ResetIn(BaseModel):
    token: Annotated[str, Field(min_length=1, max_length=200)]
    password: Annotated[Password, Field(min_length=8)]


class LoginIn(BaseModel):
    identifier: Identifier
    password: Password


class ParentAccountOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
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
            raise PydanticCustomError(
                "future_dob",
                "Vui lòng chọn ngày, tháng, năm sinh hợp lệ (không được là ngày trong tương lai).",
            )
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
