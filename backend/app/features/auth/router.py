"""Auth endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import SESSION_KEY, limit_login, require_admin
from app.features.auth import handler
from app.features.auth.schemas import LoginIn, UserOut

router = APIRouter(prefix="/api/auth")


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit_login)])
async def login(
    payload: LoginIn, request: Request, session: Annotated[AsyncSession, Depends(get_session)]
) -> UserOut:
    return UserOut(username=await handler.login(session, request, payload))


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    request.session.pop(SESSION_KEY, None)
    return Response(status_code=204)


@router.get("/me", response_model=UserOut, dependencies=[Depends(require_admin)])
async def me(request: Request) -> UserOut:
    return UserOut(username=request.session[SESSION_KEY])
