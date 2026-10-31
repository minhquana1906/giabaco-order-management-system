"""Contract error type and exception handlers."""

import logging
import traceback
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import mask_path, request_id_var

logger = logging.getLogger("app.errors")

SYSTEM_ERROR_MESSAGE = "Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút."
DB_UNAVAILABLE_MESSAGE = (
    "Hệ thống tạm thời chưa truy cập được dữ liệu. Vui lòng thử lại sau ít phút."
)
VALIDATION_MESSAGE = "Có thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu rồi thử lại."

# Starlette raises these with an English `detail`; users see the Vietnamese text instead.
_HTTP_MESSAGES = {
    404: "Không tìm thấy nội dung này.",
    405: "Thao tác này không được hỗ trợ. Tải lại trang rồi thử lại.",
    413: "Dữ liệu gửi lên quá lớn (tối đa 8 MB). Chọn tệp nhỏ hơn rồi thử lại.",
}


class ApiError(Exception):
    """Error rendered as {"error": {"code", "message", "fields"?, "request_id"?}}."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        fields: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields
        self.headers = headers


def _body(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    request_id = request_id_var.get()
    if request_id:
        error["request_id"] = request_id
    return {"error": error}


def _field_path(loc: tuple[Any, ...]) -> str:
    return ".".join(str(p) for p in loc if p not in ("body", "query", "path"))


def _is_db_outage(exc: Exception) -> bool:
    return isinstance(exc, OperationalError | InterfaceError | PoolTimeoutError)


def _origin(exc: BaseException) -> str | None:
    """Innermost application frame of the traceback, without the exception text."""
    for frame in reversed(traceback.extract_tb(exc.__traceback__)):
        if "site-packages" not in frame.filename and "/app/" in frame.filename:
            return f"app/{frame.filename.rsplit('/app/', 1)[1]}:{frame.lineno} {frame.name}"
    return None


async def _api_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    ctx: dict[str, Any] = {
        "code": exc.code,
        "status": exc.status,
        "method": request.method,
        "path": mask_path(request.url.path),
    }
    if exc.fields:
        ctx["fields"] = sorted(exc.fields)
    logger.log(
        logging.ERROR if exc.status >= 500 else logging.INFO, "api_error", extra={"ctx": ctx}
    )
    return JSONResponse(
        _body(exc.code, exc.message, exc.fields), status_code=exc.status, headers=exc.headers
    )


_BOUNDS = {
    "greater_than": ("gt", "lớn hơn {}"),
    "greater_than_equal": ("ge", "từ {} trở lên"),
    "less_than": ("lt", "nhỏ hơn {}"),
    "less_than_equal": ("le", "không quá {}"),
}
_PARSING_TYPES = {
    "int_parsing": "Vui lòng nhập số nguyên.",
    "int_from_float": "Vui lòng nhập số nguyên.",
    "float_parsing": "Vui lòng nhập một số.",
    "date_parsing": "Ngày chưa hợp lệ.",
    "date_from_datetime_parsing": "Ngày chưa hợp lệ.",
    "datetime_parsing": "Ngày giờ chưa hợp lệ.",
    "bool_parsing": "Giá trị chưa hợp lệ.",
    "uuid_parsing": "Giá trị chưa hợp lệ.",
    "literal_error": "Vui lòng chọn một giá trị trong danh sách.",
    "enum": "Vui lòng chọn một giá trị trong danh sách.",
    "string_type": "Vui lòng nhập chữ.",
    "missing": "Vui lòng nhập thông tin này.",
}


def _field_message(err: Any) -> str:
    """Vietnamese text for a field error; our own validators already raise Vietnamese."""
    kind, ctx = str(err["type"]), err.get("ctx") or {}
    if kind == "value_error":
        return str(err["msg"]).removeprefix("Value error, ")
    if kind in _PARSING_TYPES:
        return _PARSING_TYPES[kind]
    if kind in _BOUNDS:
        key, phrase = _BOUNDS[kind]
        return f"Giá trị phải {phrase.format(ctx.get(key))}."
    if kind in ("string_too_long", "too_long"):
        return f"Nội dung dài tối đa {ctx.get('max_length')} ký tự."
    if kind in ("string_too_short", "too_short"):
        return f"Nội dung cần ít nhất {ctx.get('min_length')} ký tự."
    return str(err["msg"])


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    fields: dict[str, str] = {}
    kinds: dict[str, str] = {}
    for err in exc.errors():
        path = _field_path(tuple(err["loc"]))
        fields.setdefault(path, _field_message(err))
        kinds.setdefault(path, str(err["type"]))
    # Field names and error kinds only: the submitted values may be personal data.
    logger.info(
        "validation_failed",
        extra={
            "ctx": {"method": request.method, "path": mask_path(request.url.path), "fields": kinds}
        },
    )
    return JSONResponse(_body("validation_error", VALIDATION_MESSAGE, fields), status_code=422)


async def _http_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    status = exc.status_code
    code = "not_found" if status == 404 else "http_error"
    message = _HTTP_MESSAGES.get(status) or (
        SYSTEM_ERROR_MESSAGE if status >= 500 else "Yêu cầu chưa hợp lệ. Tải lại trang rồi thử lại."
    )
    logger.log(
        logging.ERROR if status >= 500 else logging.INFO,
        "http_error",
        extra={
            "ctx": {"status": status, "method": request.method, "path": mask_path(request.url.path)}
        },
    )
    return JSONResponse(_body(code, message), status_code=status, headers=exc.headers)


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
            outage = _is_db_outage(exc)
            ctx: dict[str, Any] = {
                "error_type": type(exc).__name__,
                "method": scope["method"],
                "path": mask_path(scope["path"]),
                "origin": _origin(exc),
            }
            if isinstance(exc, DBAPIError):
                ctx["db_error"] = type(exc.orig).__name__
                ctx["sqlstate"] = getattr(exc.orig, "sqlstate", None)
            logger.error("db_unavailable" if outage else "unhandled_exception", extra={"ctx": ctx})
            if not started:
                response = JSONResponse(
                    _body(
                        "db_unavailable" if outage else "internal_error",
                        DB_UNAVAILABLE_MESSAGE if outage else SYSTEM_ERROR_MESSAGE,
                    ),
                    status_code=503 if outage else 500,
                )
                await response(scope, receive, send)


def install_error_handlers(app: FastAPI) -> None:
    """Register contract-shaped handlers."""
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_middleware(UnhandledErrorMiddleware)
