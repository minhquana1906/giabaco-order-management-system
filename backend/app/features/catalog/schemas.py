"""Catalog API schemas."""

import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator
from pydantic_core import PydanticCustomError


class ProductOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    sizes: list[str]
    has_size_guide: bool


class SchoolIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=50)

    @field_validator("name", "code")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Không được để trống")
        return v


class SchoolUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Không được để trống")
        return v


class SchoolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str


class ClassIn(BaseModel):
    grade: int = Field(ge=1, le=12)
    name: str = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Không được để trống")
        return v

    @field_validator("name")
    @classmethod
    def _starts_with_grade(cls, v: str, info: ValidationInfo) -> str:
        grade = info.data.get("grade")
        prefix = re.match(r"\d+", v)
        if grade is not None and (prefix is None or int(prefix.group()) != grade):
            raise PydanticCustomError(
                "class_grade_mismatch",
                "Tên lớp phải bắt đầu bằng số khối (khối {grade} → {grade}A1)",
                {"grade": grade},
            )
        return v


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    school_id: uuid.UUID
    grade: int
    name: str
