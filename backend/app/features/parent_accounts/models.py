"""Parent accounts and their links to students."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LinkOrigin(enum.StrEnum):
    CLAIMED = "CLAIMED"
    CREATED = "CREATED"


class ParentAccount(Base):
    __tablename__ = "parent_accounts"

    full_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    phone: Mapped[str | None] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    # Sessions signed in before this moment are rejected; set when a reset changes the password.
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ParentPasswordReset(Base):
    """A single-use reset link; only the SHA-256 of the token is stored."""

    __tablename__ = "parent_password_resets"

    parent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parent_accounts.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ParentStudentLink(Base):
    __tablename__ = "parent_student_links"
    __table_args__ = (
        UniqueConstraint("parent_id", "student_id", name="uq_parent_student_links_pair"),
    )

    parent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parent_accounts.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"))
    origin: Mapped[LinkOrigin] = mapped_column(
        Enum(LinkOrigin, name="link_origin", native_enum=False, length=10)
    )
