"""Name matching key shared by every student lookup."""

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

_WHITESPACE = r"[\s\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+"


def name_key(value: Any) -> ColumnElement[str]:
    """SQL key: NFC, collapsed whitespace, trimmed, case- and accent-insensitive.

    Apply it to both the column and the bound value so SQL and Python never diverge. Whitespace
    is collapsed before trimming because trim() only removes plain spaces. The class is spelled
    out like Python's str.isspace because Postgres' \\s depends on the locale (NBSP is not in it
    for glibc).
    """
    is_sql = isinstance(value, ColumnElement) or hasattr(value, "__clause_element__")
    expr = value if is_sql else literal(value)
    collapsed = func.regexp_replace(func.normalize(expr), _WHITESPACE, " ", "g")
    return func.lower(func.unaccent(func.trim(collapsed)))


async def lock_identity(
    session: AsyncSession, school_id: uuid.UUID, full_name: str, dob: date
) -> None:
    """Hold a transaction-scoped lock on one student identity.

    Writers that check for a matching student and then insert one take this first, so two of
    them cannot both pass the check and leave duplicates behind.
    """
    key = func.concat(str(school_id), "|", name_key(full_name), "|", dob.isoformat())
    await session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))
