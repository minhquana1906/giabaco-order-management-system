"""Public survey submission (append-only)."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.surveys.models import FORM_VERSION, SurveyResponse, area_of_ward
from app.features.surveys.schemas import SurveyIn

logger = logging.getLogger("app.surveys")


async def submit(session: AsyncSession, payload: SurveyIn) -> SurveyResponse:
    response = SurveyResponse(
        form_version=FORM_VERSION,
        school_area=area_of_ward(payload.ward),
        **payload.model_dump(),
    )
    session.add(response)
    await session.commit()
    logger.info(
        "surveys.submitted",
        extra={
            "ctx": {
                "survey_id": str(response.id),
                "school_area": response.school_area,
                "body_traits": len(payload.body_traits),
                "past_issues": len(payload.past_issues),
            }
        },
    )
    return response
