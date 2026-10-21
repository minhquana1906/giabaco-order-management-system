"""Parent portal schemas (no phone, email or dob)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.features.orders.lines import ItemLineIn, KitLineIn
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
    suggested_sizes: dict[str, str | None]


class Img(BaseModel):
    url: str
    width: int
    height: int


class Colour(BaseModel):
    code: str
    label: str
    hex: str


class OrderingCampaign(BaseModel):
    id: uuid.UUID
    name: str
    status: Literal["OPEN", "LOCKED"]
    closes_at: datetime | None


class OrderingOption(BaseModel):
    product_id: uuid.UUID
    code: str
    name: str
    sizes: list[str]
    colours: list[Colour]
    image: Img | None
    suggested: bool


class OrderingSlot(BaseModel):
    id: uuid.UUID
    label: str
    qty: int
    options: list[OrderingOption]


class OrderingKit(BaseModel):
    id: uuid.UUID
    name: str
    price: int | None
    image: Img | None
    slots: list[OrderingSlot]


class OrderingItem(BaseModel):
    product_id: uuid.UUID
    code: str
    name: str
    price: int | None
    sizes: list[str]
    colours: list[Colour]
    image: Img | None


class ViewSlotPick(BaseModel):
    slot_id: uuid.UUID
    product_id: uuid.UUID
    size_label: str
    colour: str


class ViewKitLine(BaseModel):
    kit_id: uuid.UUID
    qty: int
    size_label: str | None
    slots: list[ViewSlotPick]


class ViewItemLine(BaseModel):
    product_id: uuid.UUID
    size_label: str
    colour: str
    qty: int


class OrderView(BaseModel):
    id: uuid.UUID
    code: str
    status: str
    total: int
    has_unpriced: bool
    submitted_at: datetime | None
    kit_lines: list[ViewKitLine]
    item_lines: list[ViewItemLine]


class Ordering(BaseModel):
    campaign: OrderingCampaign | None
    kits: list[OrderingKit]
    items: list[OrderingItem]
    suggested_sizes: dict[str, str | None]
    order: OrderView | None


class OrderIn(BaseModel):
    kit_lines: list[KitLineIn] = Field(default_factory=list, max_length=20)
    item_lines: list[ItemLineIn] = Field(default_factory=list, max_length=50)
