"""Order API schemas."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.core.text import reject_control_chars
from app.features.orders.lines import ItemLineIn, KitLineIn

Gender = Literal["MALE", "FEMALE"]
OrderStatus = Literal["DRAFT", "SUBMITTED"]
OrderSource = Literal["PARENT", "STAFF", "LEGACY_IMPORT"]
GenderFilter = Literal["MALE", "FEMALE", "UNKNOWN"]


class LinesIn(BaseModel):
    kit_lines: list[KitLineIn] = Field(default_factory=list, max_length=20)
    item_lines: list[ItemLineIn] = Field(default_factory=list, max_length=50)
    submit: bool = False


class OrderUpdate(BaseModel):
    note: str | None = Field(default=None, max_length=500)
    class_label: str | None = Field(default=None, max_length=50)
    gender: Gender | None = None

    @field_validator("note", "class_label")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return reject_control_chars(v.strip()) or None


class OrderSummary(BaseModel):
    id: uuid.UUID
    code: str
    recipient_name: str
    class_label: str | None
    gender: Gender | None
    status: OrderStatus
    source: OrderSource
    item_count: int
    total: int
    has_unpriced: bool
    submitted_at: datetime | None
    updated_at: datetime


class OrderPage(BaseModel):
    items: list[OrderSummary]
    total: int
    page: int
    page_size: int


class LineOut(BaseModel):
    id: uuid.UUID
    kit_line_id: uuid.UUID | None
    slot_id: uuid.UUID | None
    slot_label: str | None
    product_id: uuid.UUID
    product_name: str
    sizes: list[str]
    colours: list[str]
    size_label: str
    colour: str
    qty: int
    unit_price: int | None
    is_tailor: bool
    measurements: dict[str, float]
    tailor_measurements: list[dict[str, Any]]
    product_tailor_measurements: list[dict[str, Any]]
    note: str | None


class KitLineOut(BaseModel):
    id: uuid.UUID
    kit_id: uuid.UUID
    kit_name: str
    qty: int


class HistoryOut(BaseModel):
    at: datetime
    actor: str
    action: str
    before: dict[str, Any] | None
    after: dict[str, Any] | None


class OrderDetail(OrderSummary):
    campaign_id: uuid.UUID
    campaign_status: Literal["DRAFT", "OPEN", "LOCKED"]
    student_id: uuid.UUID | None
    parent_name: str | None
    parent_phone: str | None
    default_size: str | None
    note: str | None
    kit_lines: list[KitLineOut]
    lines: list[LineOut]
    history: list[HistoryOut]
