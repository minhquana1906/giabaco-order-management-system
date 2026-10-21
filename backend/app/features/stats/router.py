import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import order_pivot as pivot
from app.core.db import get_session
from app.core.order_pivot import CampaignOverview, CampaignPivot, Group, Measure
from app.core.security import require_admin
from app.features.stats import handler
from app.features.stats.schemas import ClassMatrix, Overview, SizeDistribution

Session = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/api/stats", tags=["stats"], dependencies=[Depends(require_admin)])


@router.get("/overview")
async def get_overview(session: Session, school_id: uuid.UUID | None = None) -> Overview:
    return await handler.overview(session, school_id)


@router.get("/size-distribution")
async def get_size_distribution(
    product: Annotated[str, Query(min_length=1)],
    session: Session,
    school_id: uuid.UUID | None = None,
) -> SizeDistribution:
    return await handler.size_distribution(session, product, school_id)


@router.get("/class-matrix")
async def get_class_matrix(
    school_id: uuid.UUID,
    product: Annotated[str, Query(min_length=1)],
    session: Session,
) -> ClassMatrix:
    return await handler.class_matrix(session, product, school_id)


@router.get("/campaign-pivot")
async def get_campaign_pivot(
    campaign_id: uuid.UUID,
    session: Session,
    measure: Measure = "qty",
    group: Group = "product",
    kit_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
    submitted_until: date | None = None,
) -> CampaignPivot:
    return await pivot.campaign_pivot(
        session,
        campaign_id,
        measure,
        group,
        kit_id=kit_id,
        product_id=product_id,
        submitted_until=submitted_until,
    )


@router.get("/campaign-overview")
async def get_campaign_overview(
    campaign_id: uuid.UUID, session: Session, submitted_until: date | None = None
) -> CampaignOverview:
    return await pivot.campaign_overview(session, campaign_id, submitted_until)
