"""Parent account endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import (
    PARENT_SESSION_KEY,
    limit_parent_auth,
    limit_parent_match,
    require_admin,
    require_parent,
)
from app.features.parent_accounts import handler
from app.features.parent_accounts.models import ParentAccount
from app.features.parent_accounts.schemas import (
    ChildIn,
    ChildKeyIn,
    ChildSummary,
    ChildUpdateIn,
    ClassOut,
    LoginIn,
    LookupOut,
    ParentAccountOut,
    RegisterIn,
    SchoolOut,
)

router = APIRouter(prefix="/api/parent")
admin_router = APIRouter(prefix="/api/students")
Session = Annotated[AsyncSession, Depends(get_session)]


async def current_parent(
    session: Session, parent_id: Annotated[uuid.UUID, Depends(require_parent)]
) -> ParentAccount:
    return await handler.load_parent(session, parent_id)


CurrentParent = Annotated[ParentAccount, Depends(current_parent)]
MatchLimit = Annotated[None, Depends(limit_parent_match)]


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


@router.post(
    "/children/lookup",
    response_model=LookupOut,
    response_model_exclude_none=True,
    dependencies=[Depends(current_parent)],
)
async def lookup_child(payload: ChildKeyIn, session: Session, _limit: MatchLimit) -> LookupOut:
    return await handler.lookup(session, payload)


@router.post("/children/claim", response_model=ChildSummary)
async def claim_child(
    payload: ChildKeyIn, session: Session, parent: CurrentParent, _limit: MatchLimit
) -> ChildSummary:
    return await handler.claim(session, parent, payload)


@router.post("/children", response_model=ChildSummary, status_code=201)
async def create_child(
    payload: ChildIn, session: Session, parent: CurrentParent, _limit: MatchLimit
) -> ChildSummary:
    return await handler.create_child(session, parent, payload)


@router.put("/children/{student_id}", response_model=ChildSummary)
async def update_child(
    student_id: uuid.UUID, payload: ChildUpdateIn, session: Session, parent: CurrentParent
) -> ChildSummary:
    return await handler.update_child(session, parent, student_id, payload)


@router.get("/children", response_model=list[ChildSummary])
async def list_children(session: Session, parent: CurrentParent) -> list[ChildSummary]:
    return await handler.children(session, parent.id)


@router.get("/schools", response_model=list[SchoolOut], dependencies=[Depends(current_parent)])
async def list_schools(session: Session) -> list[SchoolOut]:
    return [SchoolOut.model_validate(s) for s in await handler.list_schools(session)]


@router.get(
    "/schools/{school_id}/classes",
    response_model=list[ClassOut],
    dependencies=[Depends(current_parent)],
)
async def list_classes(school_id: uuid.UUID, session: Session) -> list[ClassOut]:
    return [ClassOut.model_validate(c) for c in await handler.list_classes(session, school_id)]


@admin_router.delete("/{student_id}/parents/{parent_id}", status_code=204)
async def unlink_parent(
    student_id: uuid.UUID,
    parent_id: uuid.UUID,
    session: Session,
    actor: Annotated[str, Depends(require_admin)],
) -> Response:
    await handler.unlink(session, student_id, parent_id, actor)
    return Response(status_code=204)
