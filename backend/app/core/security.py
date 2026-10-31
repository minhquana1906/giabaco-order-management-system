"""Admin and parent auth, rate limiting, client IP and security headers."""

import getpass
import ipaddress
import logging
import math
import secrets
import sys
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable, MutableMapping

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request
from sqlalchemy import text
from starlette.datastructures import Headers
from starlette.responses import JSONResponse, RedirectResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.logging import mask_path

ADMIN_ACTOR = "admin"
SESSION_KEY = "username"
PARENT_SESSION_KEY = "parent_id"
PARENT_SESSION_AT_KEY = "parent_at"
SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."
logger = logging.getLogger("app.security")
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


_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))


def verify_password(password_hash: str | None, password: str) -> bool:
    """Verify a stored hash; hash a dummy when there is no account so timing does not leak it."""
    try:
        ok: bool = _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerificationError, InvalidHashError):
        return False
    return ok and password_hash is not None


def staff_actor(username: str) -> str:
    """Audit actor for a staff account."""
    return f"staff:{username}"


async def require_admin(request: Request) -> str:
    """Dependency: return actor or raise 401. Staff rows are checked on every request."""
    username = request.session.get(SESSION_KEY)
    if isinstance(username, str):
        if username == get_settings().admin_username:
            return ADMIN_ACTOR
        from app.core.db import SessionLocal

        async with SessionLocal() as session:
            active = await session.scalar(
                text("SELECT 1 FROM staff_accounts WHERE username = :u AND disabled_at IS NULL"),
                {"u": username},
            )
        if active:
            return staff_actor(username)
    raise ApiError(401, "unauthorized", SESSION_EXPIRED_MESSAGE)


async def require_parent(request: Request) -> uuid.UUID:
    """Dependency: return the signed-in parent id or raise 401. Ignores the admin key.

    A session stamped before the account's last password reset is rejected.
    """
    from app.core.db import SessionLocal

    try:
        parent_id = uuid.UUID(request.session.get(PARENT_SESSION_KEY))
    except (TypeError, ValueError):
        raise ApiError(401, "unauthorized", SESSION_EXPIRED_MESSAGE) from None
    async with SessionLocal() as session:
        row = (
            await session.execute(
                text("SELECT password_changed_at FROM parent_accounts WHERE id = :id"),
                {"id": parent_id},
            )
        ).first()
    if row is None:
        raise ApiError(401, "unauthorized", SESSION_EXPIRED_MESSAGE)
    changed_at = row[0]
    signed_in_at = float(request.session.get(PARENT_SESSION_AT_KEY, 0.0))
    if changed_at is not None and signed_in_at < changed_at.timestamp():
        raise ApiError(401, "unauthorized", SESSION_EXPIRED_MESSAGE)
    return parent_id


def parent_actor(parent_id: uuid.UUID) -> str:
    """Audit actor for a parent account."""
    return f"parent:{parent_id}"


def _ip_key(raw: str) -> str | None:
    try:
        ip = ipaddress.ip_address(raw.strip())
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv4Address):
        return str(ip)
    if ip.ipv4_mapped:
        return str(ip.ipv4_mapped)
    return f"{ipaddress.IPv6Address(int(ip) >> 64 << 64)}/64"


def client_ip(request: Request) -> str:
    """Rate-limit key: CF-Connecting-IP else the peer, with IPv6 grouped by /64."""
    peer = request.client.host if request.client else "unknown"
    return _ip_key(request.headers.get("cf-connecting-ip", "")) or _ip_key(peer) or peer


class RateLimiter:
    """In-memory sliding window limiter keyed by string."""

    def __init__(
        self, limit: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self.limit = limit
        self.window_s = window_s
        self._clock = clock
        self._hits: MutableMapping[str, deque[float]] = defaultdict(deque)
        self._next_sweep = clock() + window_s

    def allow(self, key: str) -> bool:
        """Record a hit; return False when over the limit."""
        now = self._clock()
        self._sweep(now)
        hits = self._hits[key]
        while hits and now - hits[0] >= self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True

    def retry_after(self, key: str) -> int:
        """Whole seconds until the oldest hit leaves the window (at least 1)."""
        hits = self._hits.get(key)
        if not hits:
            return 1
        return max(1, math.ceil(self.window_s - (self._clock() - hits[0])))

    def _sweep(self, now: float) -> None:
        """Once per window drop keys with no hit left in it, so idle clients do not pile up."""
        if now < self._next_sweep:
            return
        self._next_sweep = now + self.window_s
        stale = [k for k, hits in self._hits.items() if not hits or now - hits[-1] >= self.window_s]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        """Forget all hits."""
        self._hits.clear()


login_limiter = RateLimiter(5)
public_limiter = RateLimiter(60)
parent_auth_limiter = RateLimiter(10)
forgot_limiter = RateLimiter(5, window_s=900.0)
parent_match_limiter = RateLimiter(10)
# Generous: a parents' meeting on one school Wi-Fi or carrier CGNAT IP may submit at once.
survey_limiter = RateLimiter(60)


def _limit(limiter: RateLimiter, name: str) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        key = client_ip(request)
        if not limiter.allow(key):
            wait = limiter.retry_after(key)
            # The client address is the limiter key, so it is deliberately not logged.
            logger.warning("rate_limited", extra={"ctx": {"limiter": name, "retry_after_s": wait}})
            raise ApiError(
                429,
                "rate_limited",
                "Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại.",
                headers={"Retry-After": str(wait)},
            )

    return dependency


limit_login = _limit(login_limiter, "login")
limit_public = _limit(public_limiter, "public")
limit_parent_auth = _limit(parent_auth_limiter, "parent_auth")
limit_forgot = _limit(forgot_limiter, "forgot_password")
limit_parent_match = _limit(parent_match_limiter, "parent_match")
limit_survey = _limit(survey_limiter, "survey")

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
    """Redirect proxied plain-HTTP requests to HTTPS: HTTP drops Secure session cookies."""

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


def _under(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


ADMIN_PAGES = (
    "/",
    "/login",
    "/students",
    "/dashboard",
    "/catalog",
    "/campaigns",
    "/orders",
    "/settings",
    "/master-data",
    "/production",
    "/facility",
)
PARENT_PAGES = ("/parent", "/p", "/survey")
PARENT_APIS = ("/api/parent", "/api/public")


class HostSplitMiddleware:
    """Serve admin and parent surfaces on separate hosts; each side hides the other's."""

    def __init__(
        self,
        app: ASGIApp,
        admin_host: str,
        public_base_url: str,
        is_admin_api: Callable[[str], bool],
    ) -> None:
        self.app = app
        self.admin_host = admin_host.lower()
        self.public_base_url = public_base_url.rstrip("/")
        self.is_admin_api = is_admin_api

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope["path"]
        host = Headers(scope=scope).get("host", "").rsplit(":", 1)[0].lower()
        on_admin = host == self.admin_host
        response: Response | None = None
        if on_admin:
            if any(_under(path, p) for p in PARENT_APIS):
                response = _not_found(host, path)
            elif any(_under(path, p) for p in PARENT_PAGES):
                query = scope["query_string"].decode()
                url = f"{self.public_base_url}{path}{'?' + query if query else ''}"
                response = RedirectResponse(url, status_code=302)
        elif self.is_admin_api(path):
            response = _not_found(host, path)
        elif path == "/" or any(_under(path, p) for p in ADMIN_PAGES[1:]):
            response = RedirectResponse("/parent", status_code=302)
        if response is None:
            await self.app(scope, receive, send)
        else:
            await response(scope, receive, send)


def _not_found(host: str, path: str) -> Response:
    logger.info("cross_host_api_call", extra={"ctx": {"host": host, "path": mask_path(path)}})
    return JSONResponse(
        {"error": {"code": "not_found", "message": "Không tìm thấy nội dung này."}}, status_code=404
    )


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
