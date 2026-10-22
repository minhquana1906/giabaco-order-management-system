"""Public survey submission (append-only)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.surveys.models import FORM_VERSION, SurveyResponse, area_of_ward
from app.features.surveys.schemas import SurveyIn


async def submit(session: AsyncSession, payload: SurveyIn) -> SurveyResponse:
    response = SurveyResponse(
        form_version=FORM_VERSION,
        school_area=area_of_ward(payload.ward),
        **payload.model_dump(),
    )
    session.add(response)
    await session.commit()
    return response
