"""Auth logic."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import SESSION_KEY, verify_credentials, verify_password
from app.features.auth.models import StaffAccount
from app.features.auth.schemas import LoginIn

logger = logging.getLogger("app.auth")


async def login(session: AsyncSession, request: Request, payload: LoginIn) -> str:
    """Validate env-admin or staff credentials and start the session."""
    if payload.username == get_settings().admin_username:
        username = (
            payload.username if verify_credentials(payload.username, payload.password) else None
        )
    else:
        staff = await session.scalar(
            select(StaffAccount).where(
                StaffAccount.username == payload.username.lower(),
                StaffAccount.disabled_at.is_(None),
            )
        )
        ok = verify_password(staff.password_hash if staff else None, payload.password)
        username = staff.username if staff and ok else None
    if username is None:
        logger.warning("auth.login_failed")
        raise ApiError(
            401,
            "invalid_credentials",
            "Tên đăng nhập hoặc mật khẩu chưa đúng. Kiểm tra lại rồi thử lại.",
        )
    request.session[SESSION_KEY] = username
    logger.info("auth.login_succeeded")
    return username
