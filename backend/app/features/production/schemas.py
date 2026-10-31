"""Request and response contracts for production."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class Login(Input):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=1, max_length=256)


class StaffIn(Login):
    username: str = Field(pattern=r"^[a-z0-9._-]{3,32}$")
    password: str = Field(min_length=8, max_length=256)


class StaffUpdate(Input):
    username: str | None = Field(default=None, pattern=r"^[a-z0-9._-]{3,32}$")
    password: str | None = Field(default=None, min_length=8, max_length=256)
    disabled: bool | None = None


StepMode = Literal["partners", "internal"]


class StepIn(Input):
    position: int = Field(ge=1, le=10)
    name: Name
    deadline: date | None = None


class StepOut(BaseModel):
    position: int
    name: str
    deadline: date | None
    mode: StepMode


class StepModeIn(Input):
    mode: StepMode


class TimelineIn(Input):
    steps: list[StepIn] = Field(min_length=10, max_length=10)

    @model_validator(mode="after")
    def positions(self) -> Self:
        if {step.position for step in self.steps} != set(range(1, 11)):
            raise ValueError("positions must be 1 through 10")
        return self


Quantity = Annotated[int, Field(gt=0, le=2_147_483_647)]
Status = Literal["pending", "in_progress", "completed"]


class AssignmentIn(Input):
    campaign_id: uuid.UUID
    step_position: int = Field(ge=1, le=10)
    facility_id: uuid.UUID | None = None
    assignee: Name | None = None
    product_id: uuid.UUID | None = None
    quantity: Quantity | None = None
    deadline: date | None = None
    status: Status = "pending"
    content: str | None = Field(default=None, max_length=10000)
    actual_at: AwareDatetime | None = None


class AssignmentUpdate(Input):
    facility_id: uuid.UUID | None = None
    assignee: Name | None = None
    product_id: uuid.UUID | None = None
    quantity: Quantity | None = None
    deadline: date | None = None
    status: Status | None = None
    content: str | None = Field(default=None, max_length=10000)
    actual_at: AwareDatetime | None = None


class ProgressUpdate(Input):
    status: Status
    content: str | None = Field(default=None, max_length=10000)
    actual_at: AwareDatetime | None = None


class FacilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str
    active: bool
    main_stage: str | None = None


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    facility_id: uuid.UUID
    username: str
    disabled_at: datetime | None


class HistoryOut(BaseModel):
    id: uuid.UUID
    at: datetime
    actor: str
    status: str
    content: str | None
    actual_at: datetime | None
    deadline: date | None


class AssignmentOut(BaseModel):
    id: uuid.UUID
    campaign_id: uuid.UUID
    campaign_name: str
    step_position: int
    step_name: str
    step_mode: StepMode
    facility_id: uuid.UUID | None
    facility_name: str | None
    assignee: str | None
    product_id: uuid.UUID | None
    product_name: str | None
    quantity: int | None
    deadline: date | None
    step_deadline: date | None
    effective_deadline: date | None
    overdue: bool
    status: str
    content: str | None
    actual_at: datetime | None
    history: list[HistoryOut]


class ProgressCampaign(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    closes_at: datetime | None
    submitted_orders: int


class ProgressStep(BaseModel):
    position: int
    name: str
    deadline: date | None
    mode: StepMode
    state: Literal["unassigned", "in_progress", "completed"]
    overdue: bool
    assignments: list[AssignmentOut]


class DemandOut(BaseModel):
    product_id: uuid.UUID
    product_name: str
    ordered_qty: int


class ProgressOut(BaseModel):
    campaign: ProgressCampaign
    steps: list[ProgressStep]
    demand: list[DemandOut]


class ActivityOut(BaseModel):
    id: uuid.UUID
    at: datetime
    actor: str
    action: Literal["create", "update", "update_progress", "delete", "mode"]
    step_position: int | None
    step_name: str
    partner: str | None
    product_name: str | None
    status: str | None
    note: str | None
