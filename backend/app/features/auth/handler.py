"""Auth logic."""

from starlette.requests import Request

from app.core.errors import ApiError
from app.core.security import SESSION_KEY, verify_credentials
from app.features.auth.schemas import LoginIn


def login(request: Request, payload: LoginIn) -> str:
    """Validate credentials and start the session."""
    if not verify_credentials(payload.username, payload.password):
        raise ApiError(401, "invalid_credentials", "Sai tên đăng nhập hoặc mật khẩu")
    request.session[SESSION_KEY] = payload.username
    return payload.username
