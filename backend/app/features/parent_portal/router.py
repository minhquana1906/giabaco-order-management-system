"""Parent endpoints: by QR token (public) and by linked parent account."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import AfterValidator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import limit_public, parent_actor, require_parent
from app.core.text import reject_control_chars
from app.features.parent_portal import handler
from app.features.parent_portal.schemas import ChoiceIn, ChoiceOut, PublicStudent

router = APIRouter(prefix="/api/public/students", dependencies=[Depends(limit_public)])
account_router = APIRouter(prefix="/api/parent/children")
Session = Annotated[AsyncSession, Depends(get_session)]
ParentId = Annotated[uuid.UUID, Depends(require_parent)]
PathText = Annotated[str, AfterValidator(reject_control_chars)]


@router.get("/{token}", response_model=PublicStudent)
async def get_student(token: PathText, session: Session) -> PublicStudent:
    return await handler.get_public_student(session, await handler.student_by_token(session, token))


@router.put("/{token}/size-choices/{product_code}", response_model=ChoiceOut)
async def put_choice(
    token: PathText, product_code: PathText, payload: ChoiceIn, session: Session
) -> ChoiceOut:
    student = await handler.student_by_token(session, token)
    return await handler.set_choice(
        session, student, handler.PARENT_ACTOR, product_code, payload.size_label, payload.colour
    )


@router.delete("/{token}/size-choices/{product_code}", status_code=204)
async def delete_choice(token: PathText, product_code: PathText, session: Session) -> Response:
    student = await handler.student_by_token(session, token)
    await handler.clear_choice(session, student, handler.PARENT_ACTOR, product_code)
    return Response(status_code=204)


@account_router.get("/{student_id}", response_model=PublicStudent)
async def get_child(student_id: uuid.UUID, session: Session, parent_id: ParentId) -> PublicStudent:
    return await handler.get_public_student(
        session, await handler.student_by_link(session, parent_id, student_id)
    )


@account_router.put("/{student_id}/size-choices/{product_code}", response_model=ChoiceOut)
async def put_child_choice(
    student_id: uuid.UUID,
    product_code: PathText,
    payload: ChoiceIn,
    session: Session,
    parent_id: ParentId,
) -> ChoiceOut:
    student = await handler.student_by_link(session, parent_id, student_id)
    return await handler.set_choice(
        session, student, parent_actor(parent_id), product_code, payload.size_label, payload.colour
    )


@account_router.delete("/{student_id}/size-choices/{product_code}", status_code=204)
async def delete_child_choice(
    student_id: uuid.UUID, product_code: PathText, session: Session, parent_id: ParentId
) -> Response:
    student = await handler.student_by_link(session, parent_id, student_id)
    await handler.clear_choice(session, student, parent_actor(parent_id), product_code)
    return Response(status_code=204)
