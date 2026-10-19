import logging
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import JsonFormatter
from app.features.parent_accounts import handler as accounts
from app.features.parent_portal import handler as portal
from tests.conftest import ParentClient

MakeParent = Callable[..., Awaitable[ParentClient]]
SECRET = "bí mật đỏ"
LOOKUP = "/api/parent/children/lookup"


async def failing_query(session: AsyncSession, kind: str) -> None:
    if kind == "unique":
        for _ in range(2):
            await session.execute(
                text("INSERT INTO schools (name, code) VALUES ('x', :value)"), {"value": SECRET}
            )
    else:
        await session.execute(
            text("SELECT no_such_column FROM schools WHERE name = :value"), {"value": SECRET}
        )


def rendered_server_logs(caplog: pytest.LogCaptureFixture) -> str:
    """Every server-side record as production writes it, extras included."""
    return "\n".join(
        JsonFormatter().format(rec) for rec in caplog.records if not rec.name.startswith("httpx")
    )


async def test_database_errors_carry_no_bound_parameters(session: AsyncSession) -> None:
    with pytest.raises(DBAPIError) as info:
        await failing_query(session, "column")

    assert SECRET not in str(info.value)


@pytest.mark.parametrize(
    ("kind", "error_type"), [("column", "ProgrammingError"), ("unique", "IntegrityError")]
)
async def test_unhandled_error_returns_the_envelope_and_logs_only_class_and_path(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    make_parent: MakeParent,
    school_class: dict[str, Any],
    kind: str,
    error_type: str,
) -> None:
    async def boom(session: AsyncSession, key: Any) -> None:
        await failing_query(session, kind)

    monkeypatch.setattr(accounts, "lookup", boom)
    parent = await make_parent()
    caplog.set_level(logging.INFO)

    r = await parent.post(
        LOOKUP,
        json={
            "school_id": school_class["school_id"],
            "full_name": "Lê Minh Anh",
            "dob": "2017-09-01",
        },
    )

    assert r.status_code == 500
    assert r.json() == {
        "error": {"code": "internal_error", "message": "Lỗi hệ thống, vui lòng thử lại sau"}
    }
    assert r.headers["x-content-type-options"] == "nosniff"
    errors = [rec for rec in caplog.records if rec.levelno >= logging.ERROR]
    assert [rec.ctx for rec in errors] == [  # type: ignore[attr-defined]
        {"error_type": error_type, "path": LOOKUP}
    ]
    assert all(rec.exc_info is None for rec in errors)
    out = rendered_server_logs(caplog)
    assert error_type in out
    for private in (SECRET, "Lê Minh Anh", "2017-09-01", "no_such_column", "schools"):
        assert private not in out


async def test_unique_violation_text_itself_carries_the_value(session: AsyncSession) -> None:
    with pytest.raises(DBAPIError) as info:
        await failing_query(session, "unique")

    assert SECRET in str(info.value)


async def test_unhandled_error_log_masks_the_portal_token(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    anon_client: AsyncClient,
) -> None:
    async def boom(session: AsyncSession, token: str) -> None:
        raise RuntimeError(token)

    monkeypatch.setattr(portal, "student_by_token", boom)
    caplog.set_level(logging.INFO)

    r = await anon_client.get("/api/public/students/secret-token-123")

    assert r.status_code == 500
    out = rendered_server_logs(caplog)
    assert "secret-token-123" not in out
    assert out.count("/api/public/students/<token>") == 2
