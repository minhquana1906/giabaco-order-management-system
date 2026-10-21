"""Parent endpoints: by QR token (public) and by linked parent account."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import AfterValidator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import limit_public, parent_actor, require_parent
from app.core.text import reject_control_chars
from app.features.parent_portal import handler
from app.features.parent_portal.schemas import OrderIn, Ordering, PublicStudent

router = APIRouter(prefix="/api/public/students", dependencies=[Depends(limit_public)])
account_router = APIRouter(prefix="/api/parent/children")
Session = Annotated[AsyncSession, Depends(get_session)]
ParentId = Annotated[uuid.UUID, Depends(require_parent)]
PathText = Annotated[str, AfterValidator(reject_control_chars)]


@router.get("/{token}", response_model=PublicStudent)
async def get_student(token: PathText, session: Session) -> PublicStudent:
    return await handler.get_public_student(session, await handler.student_by_token(session, token))


@router.get("/{token}/ordering", response_model=Ordering)
async def get_ordering(token: PathText, session: Session) -> Ordering:
    return await handler.get_ordering(session, await handler.student_by_token(session, token))


@router.put("/{token}/order", response_model=Ordering)
async def put_order(token: PathText, payload: OrderIn, session: Session) -> Ordering:
    student = await handler.student_by_token(session, token)
    return await handler.submit_order(session, student, handler.PARENT_ACTOR, payload)


@account_router.get("/{student_id}", response_model=PublicStudent)
async def get_child(student_id: uuid.UUID, session: Session, parent_id: ParentId) -> PublicStudent:
    return await handler.get_public_student(
        session, await handler.student_by_link(session, parent_id, student_id)
    )


@account_router.get("/{student_id}/ordering", response_model=Ordering)
async def get_child_ordering(
    student_id: uuid.UUID, session: Session, parent_id: ParentId
) -> Ordering:
    return await handler.get_ordering(
        session, await handler.student_by_link(session, parent_id, student_id)
    )


@account_router.put("/{student_id}/order", response_model=Ordering)
async def put_child_order(
    student_id: uuid.UUID, payload: OrderIn, session: Session, parent_id: ParentId
) -> Ordering:
    student = await handler.student_by_link(session, parent_id, student_id)
    return await handler.submit_order(session, student, parent_actor(parent_id), payload)
