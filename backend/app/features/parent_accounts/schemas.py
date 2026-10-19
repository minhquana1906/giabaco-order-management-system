"""Parent account API schemas."""

import re
import unicodedata
import uuid

from pydantic import BaseModel, Field, field_validator

from app.core.phone import normalize_phone

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def _full_name(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("Không được để trống")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Email không hợp lệ")
        return v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v and v.strip() else None


class LoginIn(BaseModel):
    identifier: str
    password: str


class ParentAccountOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
