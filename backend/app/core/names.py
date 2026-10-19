"""Name matching key shared by every student lookup."""

from typing import Any

from sqlalchemy import func, literal
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
