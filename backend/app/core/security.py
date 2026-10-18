"""Admin auth, rate limiting, client IP and security headers."""

import getpass
import secrets
import sys
import time
from collections import defaultdict, deque
from collections.abc import Callable, MutableMapping

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request
from starlette.datastructures import Headers
from starlette.responses import RedirectResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings
from app.core.errors import ApiError

ADMIN_ACTOR = "admin"
SESSION_KEY = "username"
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Return an argon2 hash."""
    return _hasher.hash(password)


def verify_credentials(username: str, password: str) -> bool:
    """Check the single admin account in constant-ish time."""
    settings = get_settings()
    try:
        password_ok: bool = _hasher.verify(settings.admin_password_hash, password)
    except (VerificationError, InvalidHashError):
        password_ok = False
    user_ok = secrets.compare_digest(username.encode(), settings.admin_username.encode())
    return password_ok and user_ok


def require_admin(request: Request) -> str:
    """Dependency: return actor or raise 401."""
    if request.session.get(SESSION_KEY) != get_settings().admin_username:
        raise ApiError(401, "unauthorized", "Cần đăng nhập")
    return ADMIN_ACTOR


def client_ip(request: Request) -> str:
    """Prefer CF-Connecting-IP, fall back to the peer address."""
    forwarded = request.headers.get("cf-connecting-ip")
    if forwarded:
        return forwarded.strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """In-memory sliding window limiter keyed by string."""

    def __init__(
        self, limit: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.limit = limit
        self.window_s = window_s
        self._clock = clock
        self._hits: MutableMapping[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        """Record a hit; return False when over the limit."""
        now = self._clock()
        hits = self._hits[key]
        while hits and now - hits[0] >= self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        """Forget all hits."""
        self._hits.clear()


login_limiter = RateLimiter(5)
public_limiter = RateLimiter(60)


def _limit(limiter: RateLimiter) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        if not limiter.allow(client_ip(request)):
            raise ApiError(429, "rate_limited", "Quá nhiều yêu cầu, vui lòng thử lại sau")

    return dependency


limit_login = _limit(login_limiter)
limit_public = _limit(public_limiter)

_BASE_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"x-frame-options", b"DENY"),
]


class SecurityHeadersMiddleware:
    """Pure ASGI middleware (safe for SSE) adding security headers and noindex on public routes."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        public = scope["path"].startswith("/api/public/")

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", [])) + _BASE_HEADERS
                if public:
                    headers.append((b"x-robots-tag", b"noindex"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


class HttpsRedirectMiddleware:
    """Redirect proxied plain-HTTP requests to HTTPS: Secure session cookies are dropped over HTTP."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = Headers(scope=scope)
            host = headers.get("host")
            if host and headers.get("x-forwarded-proto") == "http":
                query = scope["query_string"].decode()
                url = f"https://{host}{scope['path']}{'?' + query if query else ''}"
                await RedirectResponse(url, status_code=308)(scope, receive, send)
                return
        await self.app(scope, receive, send)


def main(argv: list[str]) -> int:
    """CLI entry: hash-password."""
    if argv[1:2] != ["hash-password"]:
        print("usage: python -m app.core.security hash-password", file=sys.stderr)
        return 2
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Repeat: "):
        print("passwords differ", file=sys.stderr)
        return 1
    print(hash_password(password))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
