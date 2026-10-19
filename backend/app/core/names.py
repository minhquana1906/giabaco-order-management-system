"""Name matching key shared by every student lookup."""

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement


def name_key(value: Any) -> ColumnElement[str]:
    """SQL key: NFC, trimmed, collapsed spaces, case- and accent-insensitive.

    Apply it to both the column and the bound value so SQL and Python never diverge.
    """
    is_sql = isinstance(value, ColumnElement) or hasattr(value, "__clause_element__")
    expr = value if is_sql else literal(value)
    nfc = func.normalize(expr)
    collapsed = func.regexp_replace(func.trim(nfc), r"\s+", " ", "g")
    return func.lower(func.unaccent(collapsed))


async def lock_identity(
    session: AsyncSession, school_id: uuid.UUID, full_name: str, dob: date
) -> None:
    """Hold a transaction-scoped lock on one student identity.

    Writers that check for a matching student and then insert one take this first, so two of
    them cannot both pass the check and leave duplicates behind.
    """
    key = func.concat(str(school_id), "|", name_key(full_name), "|", dob.isoformat())
    await session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))
