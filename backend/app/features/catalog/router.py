"""Catalog endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.catalog import handler, measurements
from app.features.catalog.colours import COLOUR_HEX, COLOURS
from app.features.catalog.images import MAX_IMAGE_BYTES
from app.features.catalog.schemas import (
    ClassIn,
    ClassOut,
    ColourOut,
    ImageGender,
    MeasurementTypeCreate,
    MeasurementTypeOut,
    MeasurementTypeRename,
    ProductImageOut,
    ProductIn,
    ProductOut,
    ProductUpdate,
    SchoolIn,
    SchoolListOut,
    SchoolOut,
    SchoolUpdate,
)
from app.features.students.size_guide import suggest

router = APIRouter(prefix="/api", dependencies=[Depends(require_admin)])
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[str, Depends(require_admin)]


@router.get("/measurement-types", response_model=list[MeasurementTypeOut])
async def get_measurement_types(session: Session) -> list[MeasurementTypeOut]:
    return await measurements.list_types(session)


@router.post("/measurement-types", response_model=MeasurementTypeOut, status_code=201)
async def post_measurement_type(
    payload: MeasurementTypeCreate, session: Session, actor: Actor
) -> MeasurementTypeOut:
    return await measurements.create_type(session, payload, actor)


@router.patch("/measurement-types/{key}", response_model=MeasurementTypeOut)
async def patch_measurement_type(
    key: str, payload: MeasurementTypeRename, session: Session, actor: Actor
) -> MeasurementTypeOut:
    return await measurements.rename_type(session, key, payload, actor)


@router.get("/products", response_model=list[ProductOut])
async def get_products(
    session: Session, include_inactive: Annotated[bool, Query()] = False
) -> list[ProductOut]:
    return await handler.products_out(
        session, await handler.list_products(session, include_inactive)
    )


@router.post("/products", response_model=ProductOut, status_code=201)
async def post_product(payload: ProductIn, session: Session, actor: Actor) -> ProductOut:
    return await handler.create_product(session, payload, actor)


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: uuid.UUID, session: Session) -> ProductOut:
    return await handler.get_product(session, product_id)


@router.patch("/products/{product_id}", response_model=ProductOut)
async def patch_product(
    product_id: uuid.UUID, payload: ProductUpdate, session: Session, actor: Actor
) -> ProductOut:
    return await handler.update_product(session, product_id, payload, actor)


@router.get("/products/{product_id}/images", response_model=list[ProductImageOut])
async def get_product_images(
    product_id: uuid.UUID, session: Session, school_id: uuid.UUID | None = None
) -> list[ProductImageOut]:
    return await handler.list_images(session, product_id, school_id)


@router.post("/products/{product_id}/images", response_model=ProductImageOut, status_code=201)
async def post_product_image(
    product_id: uuid.UUID,
    session: Session,
    actor: Actor,
    school_id: Annotated[uuid.UUID, Form()],
    gender: Annotated[ImageGender, Form()],
    colour: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> ProductImageOut:
    data = await file.read(MAX_IMAGE_BYTES + 1)
    return await handler.add_image(session, product_id, school_id, gender, colour, data, actor)


@router.delete("/products/{product_id}/images/{image_id}", status_code=204)
async def delete_product_image(
    product_id: uuid.UUID, image_id: uuid.UUID, session: Session, actor: Actor
) -> None:
    await handler.delete_image(session, product_id, image_id, actor)


@router.get("/product-colours", response_model=list[ColourOut])
async def get_product_colours() -> list[ColourOut]:
    return [
        ColourOut(code=code, label=label, hex=COLOUR_HEX[code]) for code, label in COLOURS.items()
    ]


@router.get("/size-suggestions")
async def get_size_suggestions(
    session: Session,
    height_cm: Annotated[float, Query(gt=0)],
    weight_kg: Annotated[float, Query(gt=0)],
) -> dict[str, str | None]:
    products = await handler.list_products(session)
    return {p.code: suggest(height_cm, weight_kg, p.size_guide, p.sizes) for p in products}


@router.get("/schools", response_model=list[SchoolListOut])
async def get_schools(session: Session) -> list[SchoolListOut]:
    return await handler.list_schools(session)


@router.post("/schools", response_model=SchoolOut, status_code=201)
async def post_school(payload: SchoolIn, session: Session) -> SchoolOut:
    return SchoolOut.model_validate(await handler.create_school(session, payload))


@router.patch("/schools/{school_id}", response_model=SchoolOut)
async def patch_school(school_id: uuid.UUID, payload: SchoolUpdate, session: Session) -> SchoolOut:
    return SchoolOut.model_validate(await handler.update_school(session, school_id, payload))


@router.get("/schools/{school_id}/products", response_model=list[ProductOut])
async def get_school_products(school_id: uuid.UUID, session: Session) -> list[ProductOut]:
    return await handler.school_products_out(session, school_id)


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
