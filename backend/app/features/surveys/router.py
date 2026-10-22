"""Public survey endpoint; no session, rate limited per IP."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import limit_survey
from app.features.surveys import handler
from app.features.surveys.schemas import SurveyCreated, SurveyIn

router = APIRouter(prefix="/api/public/surveys", tags=["surveys"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.post(
    "", response_model=SurveyCreated, status_code=201, dependencies=[Depends(limit_survey)]
)
async def submit(payload: SurveyIn, session: Session) -> SurveyCreated:
    return SurveyCreated(id=(await handler.submit(session, payload)).id)
