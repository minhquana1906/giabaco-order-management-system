"""Parent size choices."""

import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

Colour = Literal["navy", "ghi"]


class ParentSizeChoice(Base):
    __tablename__ = "parent_size_choices"
    __table_args__ = (
        UniqueConstraint("student_id", "product_id", name="uq_parent_size_choices_student_product"),
        CheckConstraint("colour IN ('navy', 'ghi')", name="ck_parent_size_choices_colour"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"))
    size_label: Mapped[str] = mapped_column(Text)
    colour: Mapped[str | None] = mapped_column(Text)
    chosen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
