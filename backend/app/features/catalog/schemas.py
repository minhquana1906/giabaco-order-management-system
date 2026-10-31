"""Catalog API schemas."""

import re
import uuid
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.features.catalog.colours import COLOURS

GenderTarget = Literal["MALE", "FEMALE", "UNISEX"]
ImageGender = Literal["MALE", "FEMALE"]
CODE_PATTERN = r"^[a-z0-9_]{2,40}$"


class SizeGuideRow(BaseModel):
    size_label: str
    height_min_cm: float = Field(ge=0, le=300)
    height_max_cm: float | None = Field(ge=0, le=300)
    weight_min_kg: float = Field(ge=0, le=300)
    weight_max_kg: float | None = Field(ge=0, le=300)

    @model_validator(mode="after")
    def _ranges(self) -> Self:
        if self.height_max_cm is not None and self.height_max_cm <= self.height_min_cm:
            raise ValueError("Chiều cao tối đa phải lớn hơn tối thiểu")
        if self.weight_max_kg is not None and self.weight_max_kg <= self.weight_min_kg:
            raise ValueError("Cân nặng tối đa phải lớn hơn tối thiểu")
        return self


class TailorMeasurement(BaseModel):
    key: str = Field(pattern=CODE_PATTERN)
    label: str = Field(min_length=1, max_length=100)
    instruction: str = Field(default="", max_length=500)
    required: bool = True

    @field_validator("label")
    @classmethod
    def _label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nhãn không được để trống")
        return value


class MeasurementTypeRename(BaseModel):
    label: str = Field(min_length=1, max_length=100)

    @field_validator("label")
    @classmethod
    def _label(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Nhãn không được để trống")
        return value


class MeasurementTypeCreate(MeasurementTypeRename):
    confirm_similar: bool = False


class MeasurementTypeOut(BaseModel):
    key: str
    label: str


def _unique(values: list[str], message: str) -> list[str]:
    cleaned = [v.strip() for v in values]
    if any(not v for v in cleaned) or len(set(cleaned)) != len(cleaned):
        raise ValueError(message)
    return cleaned


class ProductBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    sizes: list[str] = Field(min_length=1, max_length=30)
    size_guide: list[SizeGuideRow] | None = None
    tailor_measurements: list[TailorMeasurement] | None = Field(default=None, max_length=30)
    colours: list[str] = Field(min_length=1, max_length=20)
    gender_target: GenderTarget = "UNISEX"
    master_product_id: uuid.UUID | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Không được để trống")
        return v

    @field_validator("description")
    @classmethod
    def _strip_description(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @field_validator("sizes")
    @classmethod
    def _sizes(cls, v: list[str]) -> list[str]:
        return _unique(v, "Cỡ không được trống hoặc trùng")

    @field_validator("colours")
    @classmethod
    def _colours(cls, v: list[str]) -> list[str]:
        v = _unique(v, "Màu không được trống hoặc trùng")
        unknown = [c for c in v if c not in COLOURS]
        if unknown:
            raise ValueError(f"Màu không có trong bảng màu: {', '.join(unknown)}")
        return v

    @model_validator(mode="after")
    def _guide_labels(self) -> Self:
        if self.tailor_measurements is not None:
            keys = [field.key for field in self.tailor_measurements]
            if len(set(keys)) != len(keys):
                raise ValueError("Mã trường số đo không được trùng")
        if self.size_guide:
            labels = [row.size_label for row in self.size_guide]
            if len(set(labels)) != len(labels) or not set(labels) <= set(self.sizes):
                raise ValueError("Bảng cỡ có cỡ trùng hoặc không thuộc danh sách cỡ")
        return self


class ProductIn(ProductBody):
    code: str = Field(pattern=CODE_PATTERN)


class ProductUpdate(ProductBody):
    active: bool


class ImageRef(BaseModel):
    url: str
    width: int
    height: int


class ProductImageOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    product_id: uuid.UUID
    gender: ImageGender
    colour: str
    url: str
    width: int
    height: int


class ProductOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    sizes: list[str]
    size_guide: list[SizeGuideRow] | None
    tailor_measurements: list[TailorMeasurement]
    colours: list[str]
    gender_target: GenderTarget
    master_product_id: uuid.UUID | None
    active: bool
    has_size_guide: bool
    school_image_counts: dict[str, int]


class ColourOut(BaseModel):
    code: str
    label: str
    hex: str


class SchoolIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=50)
    grades: list[Annotated[int, Field(ge=1, le=12)]] = Field(
        default=list(range(1, 13)), max_length=12
    )

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


class SchoolListOut(SchoolOut):
    has_open_campaign: bool


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
                "Tên lớp phải bắt đầu bằng số khối {grade}, ví dụ {grade}A1.",
                {"grade": grade},
            )
        return v


class ClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    school_id: uuid.UUID
    grade: int
    name: str
