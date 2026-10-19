"""Parent accounts and their links to students."""

import enum
import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LinkOrigin(enum.StrEnum):
    CLAIMED = "CLAIMED"
    CREATED = "CREATED"


class ParentAccount(Base):
    __tablename__ = "parent_accounts"
    __table_args__ = (
        CheckConstraint(
            "email IS NOT NULL OR phone IS NOT NULL", name="ck_parent_accounts_identifier"
        ),
    )

    full_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text, unique=True)
    phone: Mapped[str | None] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)


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
