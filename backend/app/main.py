"""FastAPI application factory and SPA hosting."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import ApiError, install_error_handlers
from app.core.logging import RequestLogMiddleware, setup_logging
from app.core.security import HttpsRedirectMiddleware, SecurityHeadersMiddleware
from app.features.auth.router import router as auth_router
from app.features.catalog.router import router as catalog_router
from app.features.exports.router import router as exports_router
from app.features.parent_accounts.router import admin_router as parent_links_router
from app.features.parent_accounts.router import router as parent_accounts_router
from app.features.parent_portal.router import account_router as parent_children_router
from app.features.parent_portal.router import router as parent_portal_router
from app.features.realtime.router import router as realtime_router
from app.features.stats.router import router as stats_router
from app.features.students.router import router as students_router

SESSION_MAX_AGE_S = 12 * 60 * 60


def _mount_spa(app: FastAPI, spa_dir: Path) -> None:
    root = spa_dir.resolve()
    index = root / "index.html"

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> Response:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(index)


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

    for router in (
        auth_router,
        catalog_router,
        students_router,
        parent_accounts_router,
        parent_links_router,
        parent_portal_router,
        parent_children_router,
        stats_router,
        exports_router,
        realtime_router,
    ):
        app.include_router(router)

    if settings.spa_dir and (Path(settings.spa_dir) / "index.html").is_file():
        _mount_spa(app, Path(settings.spa_dir))
    return app


app = create_app()
