import asyncio
import json
import uuid
from base64 import b64decode, b64encode
from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient
from itsdangerous import TimestampSigner

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import PARENT_SESSION_KEY, SESSION_KEY, require_parent, verify_password
from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME

COOKIE = "guniform_session"
JAR_DOMAIN = "test.local"
_signer = TimestampSigner(get_settings().session_secret)


def _encode(session: dict[str, Any]) -> str:
    return _signer.sign(b64encode(json.dumps(session).encode())).decode()


def _decode(cookie: str) -> dict[str, Any]:
    return json.loads(b64decode(_signer.unsign(cookie)))  # type: ignore[no-any-return]


@pytest.mark.parametrize("path", ["/api/students", "/api/events", "/api/auth/me"])
async def test_parent_session_cannot_reach_admin_routes(
    anon_client: AsyncClient, path: str
) -> None:
    anon_client.cookies.set(COOKIE, _encode({PARENT_SESSION_KEY: str(uuid.uuid4())}), JAR_DOMAIN)
    assert (await anon_client.get(path)).status_code == 401

    login = await anon_client.post(
        "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert login.status_code == 200
    if path == "/api/events":
        # the stream never ends: not answering is the proof it was let through
        with pytest.raises(TimeoutError):
            await asyncio.wait_for(anon_client.get(path), 0.3)
    else:
        assert (await anon_client.get(path)).status_code == 200


@pytest.mark.parametrize(
    "session", [{}, {SESSION_KEY: ADMIN_USERNAME}, {PARENT_SESSION_KEY: "not-a-uuid"}]
)
async def test_require_parent_rejects_non_parent_sessions(session: dict[str, Any]) -> None:
    with pytest.raises(ApiError) as exc:
        await require_parent(SimpleNamespace(session=session))  # type: ignore[arg-type]
    assert exc.value.status == 401


async def test_admin_logout_keeps_parent_session(anon_client: AsyncClient) -> None:
    parent_id = str(uuid.uuid4())
    anon_client.cookies.set(COOKIE, _encode({PARENT_SESSION_KEY: parent_id}), JAR_DOMAIN)
    r = await anon_client.post(
        "/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert r.status_code == 200
    assert _decode(anon_client.cookies[COOKIE]) == {
        PARENT_SESSION_KEY: parent_id,
        SESSION_KEY: ADMIN_USERNAME,
    }
    assert (await anon_client.post("/api/auth/logout")).status_code == 204
    assert _decode(anon_client.cookies[COOKIE]) == {PARENT_SESSION_KEY: parent_id}
    assert (await anon_client.get("/api/auth/me")).status_code == 401


def test_verify_password_without_account_is_false() -> None:
    assert verify_password(None, "anything") is False
