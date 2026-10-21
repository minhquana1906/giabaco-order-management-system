"""Campaign endpoints (admin)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.campaigns import handler
from app.features.campaigns.schemas import (
    CampaignIn,
    CampaignOut,
    CampaignSummary,
    CampaignUpdate,
    ItemsIn,
    KitsIn,
)

router = APIRouter(prefix="/api/campaigns", dependencies=[Depends(require_admin)])
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[str, Depends(require_admin)]


@router.get("", response_model=list[CampaignSummary])
async def get_campaigns(
    session: Session, school_id: uuid.UUID | None = None
) -> list[CampaignSummary]:
    return await handler.list_campaigns(session, school_id)


@router.post("", response_model=CampaignOut, status_code=201)
async def post_campaign(payload: CampaignIn, session: Session, actor: Actor) -> CampaignOut:
    return await handler.create_campaign(session, payload, actor)


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, session: Session) -> CampaignOut:
    return await handler.get_campaign(session, campaign_id)


@router.patch("/{campaign_id}", response_model=CampaignOut)
async def patch_campaign(
    campaign_id: uuid.UUID, payload: CampaignUpdate, session: Session, actor: Actor
) -> CampaignOut:
    return await handler.update_campaign(session, campaign_id, payload, actor)


@router.put("/{campaign_id}/items", response_model=CampaignOut)
async def put_items(
    campaign_id: uuid.UUID, payload: ItemsIn, session: Session, actor: Actor
) -> CampaignOut:
    return await handler.replace_items(session, campaign_id, payload, actor)


@router.put("/{campaign_id}/kits", response_model=CampaignOut)
async def put_kits(
    campaign_id: uuid.UUID, payload: KitsIn, session: Session, actor: Actor
) -> CampaignOut:
    return await handler.replace_kits(session, campaign_id, payload, actor)


@router.post("/{campaign_id}/open", response_model=CampaignOut)
async def post_open(campaign_id: uuid.UUID, session: Session, actor: Actor) -> CampaignOut:
    return await handler.transition(session, campaign_id, "open", actor)


@router.post("/{campaign_id}/lock", response_model=CampaignOut)
async def post_lock(campaign_id: uuid.UUID, session: Session, actor: Actor) -> CampaignOut:
    return await handler.transition(session, campaign_id, "lock", actor)


@router.post("/{campaign_id}/reopen", response_model=CampaignOut)
async def post_reopen(campaign_id: uuid.UUID, session: Session, actor: Actor) -> CampaignOut:
    return await handler.transition(session, campaign_id, "reopen", actor)
