"""Order endpoints (admin)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.orders import handler
from app.features.orders.schemas import (
    GenderFilter,
    LinesIn,
    OrderDetail,
    OrderPage,
    OrderStatus,
    OrderUpdate,
)

router = APIRouter(prefix="/api", dependencies=[Depends(require_admin)])
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[str, Depends(require_admin)]


@router.get("/campaigns/{campaign_id}/orders", response_model=OrderPage)
async def get_orders(
    campaign_id: uuid.UUID,
    session: Session,
    q: str | None = None,
    gender: GenderFilter | None = None,
    status: OrderStatus | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
) -> OrderPage:
    return await handler.list_orders(session, campaign_id, q, gender, status, page)


@router.get("/orders/{order_id}", response_model=OrderDetail)
async def get_order(order_id: uuid.UUID, session: Session) -> OrderDetail:
    return await handler.detail(session, order_id)


@router.put("/orders/{order_id}/lines", response_model=OrderDetail)
async def put_lines(
    order_id: uuid.UUID, payload: LinesIn, session: Session, actor: Actor
) -> OrderDetail:
    return await handler.replace_lines_admin(session, order_id, payload, actor)


@router.patch("/orders/{order_id}", response_model=OrderDetail)
async def patch_order(
    order_id: uuid.UUID, payload: OrderUpdate, session: Session, actor: Actor
) -> OrderDetail:
    return await handler.update_order(session, order_id, payload, actor)
