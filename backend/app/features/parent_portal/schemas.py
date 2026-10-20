"""Parent portal schemas (no phone, email or dob)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.features.parent_portal.models import Colour
from app.features.students.models import DataSource, Fit, Gender


class PublicTrial(BaseModel):
    product_code: str
    product_name: str
    size_label: str
    fit: Fit


class PublicProduct(BaseModel):
    code: str
    name: str
    sizes: list[str]


class PublicChoice(BaseModel):
    size_label: str
    colour: Colour | None


class PublicStudent(BaseModel):
    full_name: str
    school_name: str
    class_name: str
    gender: Gender
    data_source: DataSource
    height_cm: float
    weight_kg: float
    measured_at: datetime
    trials: list[PublicTrial]
    products: list[PublicProduct]
    choices: dict[str, PublicChoice]
    suggested_sizes: dict[str, str | None]


class ChoiceIn(BaseModel):
    size_label: str = Field(min_length=1)
    colour: Colour


class ChoiceOut(BaseModel):
    product_code: str
    size_label: str
    colour: Colour
    chosen_at: datetime
