"""Master records and production facilities, separate from the sales catalog."""

import unicodedata
from typing import Any

from sqlalchemy import CheckConstraint, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

INACTIVE_PREFIXES = ("tạm dừng", "ngưng", "ngừng")


class MasterRecord(Base):
    __tablename__ = "master_records"
    __table_args__ = (
        UniqueConstraint("kind", "code", name="uq_master_records_kind_code"),
        CheckConstraint(
            "kind IN ('materials', 'suppliers', 'products')", name="ck_master_records_kind"
        ),
        CheckConstraint("length(trim(code)) > 0", name="ck_master_records_code"),
    )

    kind: Mapped[str] = mapped_column(Text)
    code: Mapped[str] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)


class Facility(Base):
    """A production facility (GUF-*): master profile plus the target of staff and orders."""

    __tablename__ = "production_facilities"
    __table_args__ = (
        CheckConstraint("length(trim(code)) > 0", name="ck_production_facilities_code"),
    )

    code: Mapped[str] = mapped_column(Text, unique=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB)

    @property
    def name(self) -> str:
        return self.data.get("Tên cơ sở/đối tác") or self.code

    @property
    def active(self) -> bool:
        """Staff may sign in and receive orders unless cooperation is paused or stopped."""
        status = unicodedata.normalize("NFC", self.data.get("Trạng thái hợp tác") or "")
        return not status.strip().casefold().startswith(INACTIVE_PREFIXES)
