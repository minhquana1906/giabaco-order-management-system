"""Student API schemas and input normalization."""

import re
import unicodedata
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.core.phone import normalize_phone
from app.features.parent_accounts.models import LinkOrigin
from app.features.parent_portal.models import Colour
from app.features.students.models import HEIGHT_RANGE, WEIGHT_RANGE, DataSource, Fit, Gender

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def clean_text(value: str) -> str:
    """Trim and NFC-normalize while keeping diacritics."""
    return unicodedata.normalize("NFC", value.strip())


class TrialIn(BaseModel):
    id: uuid.UUID | None = None
    product_code: str = Field(min_length=1)
    size_label: str = Field(min_length=1)
    fit: Fit
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def _note(cls, v: str | None) -> str | None:
        return clean_text(v) or None if v is not None else None


class StudentIn(BaseModel):
    school_id: uuid.UUID
    class_id: uuid.UUID
    full_name: str = Field(min_length=1, max_length=200)
    dob: date
    gender: Gender
    height_cm: Annotated[
        Decimal, Field(ge=HEIGHT_RANGE[0], le=HEIGHT_RANGE[1], max_digits=4, decimal_places=1)
    ]
    weight_kg: Annotated[
        Decimal, Field(ge=WEIGHT_RANGE[0], le=WEIGHT_RANGE[1], max_digits=3, decimal_places=1)
    ]
    parent_name: str | None = Field(default=None, max_length=200)
    parent_phone: str | None = None
    parent_email: str | None = Field(default=None, max_length=200)
    trials: list[TrialIn] = Field(default_factory=list, max_length=50)
    force: bool = False

    @field_validator("full_name")
    @classmethod
    def _full_name(cls, v: str) -> str:
        v = clean_text(v)
        if not v:
            raise ValueError("Không được để trống")
        return v

    @field_validator("dob")
    @classmethod
    def _dob(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("Ngày sinh phải trong quá khứ")
        return v

    @field_validator("parent_name")
    @classmethod
    def _parent_name(cls, v: str | None) -> str | None:
        return clean_text(v) or None if v is not None else None

    @field_validator("parent_phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v and v.strip() else None

    @field_validator("parent_email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Email không hợp lệ")
        return v


class NamedRef(BaseModel):
    id: uuid.UUID
    name: str


class ClassRef(NamedRef):
    grade: int


class TrialOut(BaseModel):
    id: uuid.UUID
    product_code: str
    product_name: str
    size_label: str
    suggested_size_label: str | None
    fit: Fit
    note: str | None
    tried_at: datetime


class ParentChoiceOut(BaseModel):
    product_code: str
    product_name: str
    size_label: str
    colour: Colour | None
    chosen_at: datetime


class LinkedParentOut(BaseModel):
    parent_id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    origin: LinkOrigin
    linked_at: datetime


class StudentDetail(BaseModel):
    id: uuid.UUID
    full_name: str
    dob: date
    gender: Gender
    height_cm: float
    weight_kg: float
    parent_name: str | None
    parent_phone: str | None
    parent_email: str | None
    school: NamedRef
    class_: ClassRef = Field(serialization_alias="class")
    portal_token: str
    portal_url: str
    data_source: DataSource
    measured_at: datetime
    created_at: datetime
    updated_at: datetime
    trials: list[TrialOut]
    derived_sizes: dict[str, str | None]
    parent_choices: list[ParentChoiceOut]
    linked_parents: list[LinkedParentOut]


class StudentListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    gender: Gender
    school: NamedRef
    class_: ClassRef = Field(serialization_alias="class")
    height_cm: float
    weight_kg: float
    parent_phone: str | None
    data_source: DataSource
    derived_sizes: dict[str, str | None]
    trial_count: int
    has_note: bool
    created_at: datetime


class StudentPage(BaseModel):
    items: list[StudentListItem]
    total: int
    page: int
    page_size: int
