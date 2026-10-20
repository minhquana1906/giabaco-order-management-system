"""Contract error type and exception handlers."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import mask_path

logger = logging.getLogger("app.errors")


class ApiError(Exception):
    """Error rendered as {"error": {"code", "message", "fields"?}}."""

    def __init__(
        self, status: int, code: str, message: str, fields: dict[str, str] | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


def _body(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    return {"error": error}


def _field_path(loc: tuple[Any, ...]) -> str:
    return ".".join(str(p) for p in loc if p not in ("body", "query", "path"))


async def _api_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return JSONResponse(_body(exc.code, exc.message, exc.fields), status_code=exc.status)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    fields: dict[str, str] = {}
    for err in exc.errors():
        fields.setdefault(_field_path(tuple(err["loc"])), str(err["msg"]))
    return JSONResponse(_body("validation_error", "Dữ liệu không hợp lệ", fields), status_code=422)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = "not_found" if exc.status_code == 404 else "http_error"
    return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code)


class UnhandledErrorMiddleware:
    """Turn any uncaught exception into the 500 envelope and log only its class and path.

    Starlette's own 500 handler re-raises after responding, so the server would log the full
    traceback and exception text, which can carry request data. Sitting inside the other
    middleware keeps the security headers on the response.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal started
            started = started or message["type"] == "http.response.start"
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            logger.error(
                "unhandled_exception",
                extra={"ctx": {"error_type": type(exc).__name__, "path": mask_path(scope["path"])}},
            )
            if not started:
                response = JSONResponse(
                    _body("internal_error", "Lỗi hệ thống, vui lòng thử lại sau"), status_code=500
                )
                await response(scope, receive, send)


def install_error_handlers(app: FastAPI) -> None:
    """Register contract-shaped handlers."""
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_middleware(UnhandledErrorMiddleware)
