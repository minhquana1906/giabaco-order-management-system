"""Auth endpoints."""

from fastapi import APIRouter, Depends, Request, Response

from app.core.config import get_settings
from app.core.security import limit_login, require_admin
from app.features.auth import handler
from app.features.auth.schemas import LoginIn, UserOut

router = APIRouter(prefix="/api/auth")


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit_login)])
async def login(payload: LoginIn, request: Request) -> UserOut:
    return UserOut(username=handler.login(request, payload))


@router.post("/logout", status_code=204)
async def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=204)


@router.get("/me", response_model=UserOut, dependencies=[Depends(require_admin)])
async def me() -> UserOut:
    return UserOut(username=get_settings().admin_username)
