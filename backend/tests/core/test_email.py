import json
import logging
from types import SimpleNamespace

import httpx
import pytest

from app.core import email

REAL_SEND = email.send  # the autouse `outbox` fixture replaces email.send per test
ADDRESS = "secret.parent@example.com"
TOKEN_LINK = "https://giabaco.example/parent/reset#token=SECRETTOKEN"


def _use(monkeypatch: pytest.MonkeyPatch, handler: httpx.MockTransport, key: str | None) -> None:
    monkeypatch.setattr(
        email, "get_settings", lambda: SimpleNamespace(resend_api_key=key, mail_from="G <a@b.vn>")
    )
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        email.httpx, "AsyncClient", lambda **kw: real_client(transport=handler, **kw)
    )


async def test_send_posts_the_message_to_resend_with_the_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "1"})

    _use(monkeypatch, httpx.MockTransport(handle), "re_key")

    await REAL_SEND(ADDRESS, "Subject", "<p>x</p>", "x")

    assert seen[0].headers["authorization"] == "Bearer re_key"
    assert json.loads(seen[0].content) == {
        "from": "G <a@b.vn>",
        "to": [ADDRESS],
        "subject": "Subject",
        "html": "<p>x</p>",
        "text": "x",
    }


@pytest.mark.parametrize("failure", ["status", "network"])
async def test_failed_send_never_raises_and_never_logs_the_address_or_link(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, failure: str
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if failure == "network":
            raise httpx.ConnectError("boom", request=request)
        return httpx.Response(403, json={"message": f"bad {ADDRESS}"})

    _use(monkeypatch, httpx.MockTransport(handle), "re_key")
    caplog.set_level(logging.DEBUG)

    await REAL_SEND(ADDRESS, "Subject", f"<a href='{TOKEN_LINK}'>x</a>", TOKEN_LINK)

    assert "email not sent" in caplog.text
    assert ADDRESS not in caplog.text and "SECRETTOKEN" not in caplog.text


async def test_missing_configuration_sends_nothing(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not call Resend")

    _use(monkeypatch, httpx.MockTransport(handle), None)

    await REAL_SEND(ADDRESS, "Subject", "<p>x</p>", "x")

    assert "not configured" in caplog.text and ADDRESS not in caplog.text
