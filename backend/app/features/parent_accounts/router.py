"""Parent account endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import PARENT_SESSION_KEY, limit_parent_auth, require_parent
from app.features.parent_accounts import handler
from app.features.parent_accounts.models import ParentAccount
from app.features.parent_accounts.schemas import LoginIn, ParentAccountOut, RegisterIn

router = APIRouter(prefix="/api/parent")
Session = Annotated[AsyncSession, Depends(get_session)]


async def current_parent(
    session: Session, parent_id: Annotated[uuid.UUID, Depends(require_parent)]
) -> ParentAccount:
    return await handler.load_parent(session, parent_id)


CurrentParent = Annotated[ParentAccount, Depends(current_parent)]


@router.post(
    "/auth/register",
    response_model=ParentAccountOut,
    status_code=201,
    dependencies=[Depends(limit_parent_auth)],
)
async def register(payload: RegisterIn, request: Request, session: Session) -> ParentAccountOut:
    return handler.account_out(await handler.register(session, request, payload))


@router.post(
    "/auth/login", response_model=ParentAccountOut, dependencies=[Depends(limit_parent_auth)]
)
async def login(payload: LoginIn, request: Request, session: Session) -> ParentAccountOut:
    return handler.account_out(await handler.login(session, request, payload))


@router.post("/auth/logout", status_code=204)
async def logout(request: Request) -> Response:
    request.session.pop(PARENT_SESSION_KEY, None)
    return Response(status_code=204)


@router.get("/auth/me", response_model=ParentAccountOut)
async def me(parent: CurrentParent) -> ParentAccountOut:
    return handler.account_out(parent)
