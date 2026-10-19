"""JSON logging with PII masking and a body-free request logger."""

import json
import logging
import re
import sys
import time
from datetime import UTC, datetime
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

PII_KEYS = frozenset(
    {
        "full_name",
        "parent_name",
        "parent_phone",
        "parent_email",
        "dob",
        "phone",
        "email",
        "name",
        "identifier",
        "password",
    }
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){9}(?!\d)")
_PUBLIC_TOKEN = re.compile(r"(/api/public/students/)[^/]+")
MASK = "***"


def mask_text(text: str) -> str:
    """Mask emails and phone numbers inside free text."""
    return _PHONE.sub(MASK, _EMAIL.sub(MASK, text))


def mask_value(value: Any) -> Any:
    """Recursively mask PII keys in dicts/lists and PII patterns in strings."""
    if isinstance(value, dict):
        return {k: MASK if k in PII_KEYS else mask_value(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [mask_value(v) for v in value]
    if isinstance(value, str):
        return mask_text(value)
    return value


class JsonFormatter(logging.Formatter):
    """One JSON object per line, PII-masked."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": mask_text(record.getMessage()),
        }
        extra = getattr(record, "ctx", None)
        if extra:
            payload.update(mask_value(extra))
        if record.exc_info:
            payload["exc"] = mask_text(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    """Install the JSON handler on the root logger."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").disabled = True


request_logger = logging.getLogger("app.request")


class RequestLogMiddleware:
    """Log method, path (no query, token masked), status and duration. Never the body."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            path = _PUBLIC_TOKEN.sub(r"\1<token>", scope["path"])
            request_logger.info(
                "request",
                extra={
                    "ctx": {
                        "method": scope["method"],
                        "path": path,
                        "status": status,
                        "ms": round((time.perf_counter() - start) * 1000, 1),
                    }
                },
            )
