"""FastAPI application factory and SPA hosting."""

from collections.abc import Callable, Sequence
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.dependencies.models import Dependant
from fastapi.responses import FileResponse, Response
from fastapi.routing import APIRoute
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import ApiError, install_error_handlers
from app.core.logging import RequestLogMiddleware, setup_logging
from app.core.security import (
    HostSplitMiddleware,
    HttpsRedirectMiddleware,
    SecurityHeadersMiddleware,
    require_admin,
)
from app.features.auth.router import router as auth_router
from app.features.campaigns.router import router as campaigns_router
from app.features.catalog.router import router as catalog_router
from app.features.exports.router import router as exports_router
from app.features.orders.router import router as orders_router
from app.features.parent_accounts.router import admin_router as parent_links_router
from app.features.parent_accounts.router import router as parent_accounts_router
from app.features.parent_portal.router import account_router as parent_children_router
from app.features.parent_portal.router import router as parent_portal_router
from app.features.realtime.router import router as realtime_router
from app.features.stats.router import router as stats_router
from app.features.students.router import router as students_router
from app.features.surveys.router import router as surveys_router

ROUTERS = (
    auth_router,
    catalog_router,
    campaigns_router,
    orders_router,
    students_router,
    parent_accounts_router,
    parent_links_router,
    parent_portal_router,
    parent_children_router,
    surveys_router,
    stats_router,
    exports_router,
    realtime_router,
)
SESSION_MAX_AGE_S = 12 * 60 * 60


MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable"


def _mount_media(app: FastAPI, media_dir: Path) -> None:
    root = media_dir.resolve()

    @app.get("/media/{path:path}", include_in_schema=False)
    async def media(path: str) -> Response:
        try:
            candidate = (root / path).resolve()
            found = candidate.is_relative_to(root) and candidate.is_file()
        except (ValueError, OSError):
            found = False
        if not found:
            raise HTTPException(404, "Not found")
        return FileResponse(candidate, headers={"Cache-Control": MEDIA_CACHE_CONTROL})


def _mount_spa(app: FastAPI, spa_dir: Path) -> None:
    root = spa_dir.resolve()
    index = root / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            # Vite emits content-hashed names under assets/, so they can never change in place.
            headers = {"Cache-Control": MEDIA_CACHE_CONTROL} if path.startswith("assets/") else None
            return FileResponse(candidate, headers=headers)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


def _guarded(route: APIRoute) -> bool:
    return any(d.dependency is require_admin for d in route.dependencies) or _uses_require_admin(
        route.dependant
    )


def _uses_require_admin(dependant: Dependant) -> bool:
    return any(d.call is require_admin or _uses_require_admin(d) for d in dependant.dependencies)


def _admin_api_matcher(routers: Sequence[APIRouter]) -> Callable[[str], bool]:
    patterns = [
        r.path_regex
        for router in routers
        for r in router.routes
        if isinstance(r, APIRoute) and _guarded(r)
    ]

    def matches(path: str) -> bool:
        return path.startswith("/api/auth/") or any(p.match(path) for p in patterns)

    return matches


def create_app() -> FastAPI:
    """Build the application."""
    settings = get_settings()
    setup_logging()
    app = FastAPI(title="G-UNIFORM", docs_url=None, redoc_url=None, openapi_url=None)
    install_error_handlers(app)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="guniform_session",
        max_age=SESSION_MAX_AGE_S,
        same_site="lax",
        https_only=settings.cookie_secure,
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLogMiddleware)
    if settings.cookie_secure:
        app.add_middleware(HttpsRedirectMiddleware)

    @app.get("/api/healthz")
    async def healthz() -> dict[str, str]:
        try:
            async with SessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except Exception:
            raise ApiError(503, "unavailable", "Database không khả dụng") from None
        return {"status": "ok"}

    for router in ROUTERS:
        app.include_router(router)

    if settings.admin_host:
        app.add_middleware(
            HostSplitMiddleware,
            admin_host=settings.admin_host,
            public_base_url=settings.public_base_url,
            is_admin_api=_admin_api_matcher(ROUTERS),
        )

    _mount_media(app, Path(settings.media_dir))

    if settings.spa_dir and (Path(settings.spa_dir) / "index.html").is_file():
        _mount_spa(app, Path(settings.spa_dir))
    return app


app = create_app()
