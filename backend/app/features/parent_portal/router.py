"""Public parent endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import limit_public
from app.features.parent_portal import handler
from app.features.parent_portal.schemas import ChoiceIn, ChoiceOut, PublicStudent

router = APIRouter(prefix="/api/public/students", dependencies=[Depends(limit_public)])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/{token}", response_model=PublicStudent)
async def get_student(token: str, session: Session) -> PublicStudent:
    return await handler.get_public_student(session, token)


@router.put("/{token}/size-choices/{product_code}", response_model=ChoiceOut)
async def put_choice(
    token: str, product_code: str, payload: ChoiceIn, session: Session
) -> ChoiceOut:
    return await handler.set_choice(session, token, product_code, payload.size_label)


@router.delete("/{token}/size-choices/{product_code}", status_code=204)
async def delete_choice(token: str, product_code: str, session: Session) -> Response:
    await handler.clear_choice(session, token, product_code)
    return Response(status_code=204)
