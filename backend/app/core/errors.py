"""Contract error type and exception handlers."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


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


def install_error_handlers(app: FastAPI) -> None:
    """Register contract-shaped handlers."""
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
