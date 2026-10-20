"""Staff accounts: admin-side users with the same rights as the env admin."""

from datetime import datetime

from sqlalchemy import DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class StaffAccount(Base):
    __tablename__ = "staff_accounts"

    username: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
