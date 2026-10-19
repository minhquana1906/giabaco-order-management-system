"""Parent account use cases."""

import uuid

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core import audit
from app.core.errors import ApiError
from app.core.phone import normalize_phone
from app.core.security import PARENT_SESSION_KEY, hash_password, parent_actor, verify_password
from app.features.parent_accounts.models import ParentAccount
from app.features.parent_accounts.schemas import LoginIn, ParentAccountOut, RegisterIn


def _unauthorized() -> ApiError:
    return ApiError(401, "unauthorized", "Cần đăng nhập")


def account_out(parent: ParentAccount) -> ParentAccountOut:
    return ParentAccountOut(
        id=parent.id, full_name=parent.full_name, email=parent.email, phone=parent.phone
    )


async def load_parent(session: AsyncSession, parent_id: uuid.UUID) -> ParentAccount:
    """The signed-in account; a cookie for a vanished account is unauthorized."""
    parent = await session.get(ParentAccount, parent_id)
    if parent is None:
        raise _unauthorized()
    return parent


async def register(session: AsyncSession, request: Request, payload: RegisterIn) -> ParentAccount:
    """Create the account and sign it in."""
    if payload.email is None and payload.phone is None:
        raise ApiError(
            422,
            "validation_error",
            "Cần email hoặc số điện thoại",
            {"email": "Nhập email hoặc số điện thoại"},
        )
    parent = ParentAccount(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=await run_in_threadpool(hash_password, payload.password),
    )
    session.add(parent)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "account_exists", "Email hoặc số điện thoại đã được đăng ký") from None
    await audit.record(
        session, parent_actor(parent.id), "parent_account.register", "parent_account", parent.id,
        None, {"has_email": parent.email is not None, "has_phone": parent.phone is not None},
    )  # fmt: skip
    await session.commit()
    request.session[PARENT_SESSION_KEY] = str(parent.id)
    return parent


async def _find_by_identifier(session: AsyncSession, identifier: str) -> ParentAccount | None:
    identifier = identifier.strip()
    if "@" in identifier:
        condition = ParentAccount.email == identifier.lower()
    else:
        try:
            condition = ParentAccount.phone == normalize_phone(identifier)
        except ValueError:
            return None
    return await session.scalar(select(ParentAccount).where(condition))


async def login(session: AsyncSession, request: Request, payload: LoginIn) -> ParentAccount:
    """Verify credentials; a missing account costs the same hash as a wrong password."""
    parent = await _find_by_identifier(session, payload.identifier)
    password_ok = await run_in_threadpool(
        verify_password, parent.password_hash if parent else None, payload.password
    )
    if parent is None or not password_ok:
        raise ApiError(401, "invalid_credentials", "Sai thông tin đăng nhập")
    request.session[PARENT_SESSION_KEY] = str(parent.id)
    return parent
