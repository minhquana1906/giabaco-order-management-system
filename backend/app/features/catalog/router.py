"""Catalog endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.catalog import handler
from app.features.catalog.schemas import (
    ClassIn,
    ClassOut,
    ProductOut,
    SchoolIn,
    SchoolOut,
    SchoolUpdate,
)
from app.features.students.size_guide import suggest

router = APIRouter(prefix="/api", dependencies=[Depends(require_admin)])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/products", response_model=list[ProductOut])
async def get_products(session: Session) -> list[ProductOut]:
    products = await handler.list_products(session)
    return [
        ProductOut(
            id=p.id, code=p.code, name=p.name, sizes=p.sizes, has_size_guide=bool(p.size_guide)
        )
        for p in products
    ]


@router.get("/size-suggestions")
async def get_size_suggestions(
    session: Session,
    height_cm: Annotated[float, Query(gt=0)],
    weight_kg: Annotated[float, Query(gt=0)],
) -> dict[str, str | None]:
    products = await handler.list_products(session)
    return {p.code: suggest(height_cm, weight_kg, p.size_guide, p.sizes) for p in products}


@router.get("/schools", response_model=list[SchoolOut])
async def get_schools(session: Session) -> list[SchoolOut]:
    return [SchoolOut.model_validate(s) for s in await handler.list_schools(session)]


@router.post("/schools", response_model=SchoolOut, status_code=201)
async def post_school(payload: SchoolIn, session: Session) -> SchoolOut:
    return SchoolOut.model_validate(await handler.create_school(session, payload))


@router.patch("/schools/{school_id}", response_model=SchoolOut)
async def patch_school(school_id: uuid.UUID, payload: SchoolUpdate, session: Session) -> SchoolOut:
    return SchoolOut.model_validate(await handler.update_school(session, school_id, payload))


@router.get("/schools/{school_id}/classes", response_model=list[ClassOut])
async def get_classes(school_id: uuid.UUID, session: Session) -> list[ClassOut]:
    return [ClassOut.model_validate(c) for c in await handler.list_classes(session, school_id)]


@router.post("/schools/{school_id}/classes", response_model=ClassOut, status_code=201)
async def post_class(school_id: uuid.UUID, payload: ClassIn, session: Session) -> ClassOut:
    return ClassOut.model_validate(await handler.create_class(session, school_id, payload))


@router.patch("/schools/{school_id}/classes/{class_id}", response_model=ClassOut)
async def patch_class(
    school_id: uuid.UUID, class_id: uuid.UUID, payload: ClassIn, session: Session
) -> ClassOut:
    return ClassOut.model_validate(
        await handler.update_class(session, school_id, class_id, payload)
    )
