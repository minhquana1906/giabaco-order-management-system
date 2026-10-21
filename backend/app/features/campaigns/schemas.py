"""Campaign API schemas."""

import re
import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["DRAFT", "OPEN", "LOCKED"]
KIT_CODE = r"^[a-z0-9_]{2,40}$"
SCHOOL_YEAR = re.compile(r"^(\d{4})-(\d{4})$")


def _text(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Không được để trống")
    return v


class CampaignBody(BaseModel):
    name: str = Field(max_length=200)
    school_year: str
    opens_at: AwareDatetime | None = None
    closes_at: AwareDatetime | None = None

    _name = field_validator("name")(_text)

    @field_validator("school_year")
    @classmethod
    def _year(cls, v: str) -> str:
        match = SCHOOL_YEAR.match(v.strip())
        if match is None or int(match[2]) != int(match[1]) + 1:
            raise ValueError("Năm học dạng 2026-2027")
        return v.strip()

    @model_validator(mode="after")
    def _window(self) -> Self:
        if self.opens_at and self.closes_at and self.closes_at <= self.opens_at:
            raise ValueError("Thời gian đóng phải sau thời gian mở")
        return self


class CampaignIn(CampaignBody):
    school_id: uuid.UUID


class CampaignUpdate(CampaignBody):
    opens_at: AwareDatetime


class ItemIn(BaseModel):
    product_id: uuid.UUID
    unit_price: int | None = Field(default=None, ge=0, le=100_000_000)
    colour: str
    sort: int = Field(default=0, ge=0, le=32000)


class ItemsIn(BaseModel):
    items: list[ItemIn] = Field(max_length=100)


class SlotIn(BaseModel):
    label: str = Field(max_length=100)
    qty: int = Field(ge=1, le=10)
    product_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)

    _label = field_validator("label")(_text)


class KitIn(BaseModel):
    code: str = Field(pattern=KIT_CODE)
    name: str = Field(max_length=200)
    slots: list[SlotIn] = Field(min_length=1, max_length=10)

    _name = field_validator("name")(_text)


class KitsIn(BaseModel):
    kits: list[KitIn] = Field(max_length=50)


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    product_id: uuid.UUID
    unit_price: int | None
    colour: str
    sort: int


class SlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    label: str
    qty: int
    product_ids: list[uuid.UUID]


class KitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str
    slots: list[SlotOut]


class CampaignSummary(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    school_year: str
    opens_at: datetime
    closes_at: datetime | None
    status: Status
    updated_at: datetime
    item_count: int
    kit_count: int


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    school_year: str
    opens_at: datetime
    closes_at: datetime | None
    status: Status
    updated_at: datetime
    items: list[ItemOut]
    kits: list[KitOut]
