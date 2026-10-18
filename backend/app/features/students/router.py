"""Student endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.students import handler
from app.features.students.schemas import StudentDetail, StudentIn, StudentPage

router = APIRouter(prefix="/api/students")
Session = Annotated[AsyncSession, Depends(get_session)]
Actor = Annotated[str, Depends(require_admin)]


@router.post("", response_model=StudentDetail, response_model_by_alias=True, status_code=201)
async def create_student(payload: StudentIn, session: Session, actor: Actor) -> StudentDetail:
    student_id = await handler.create_student(session, payload, actor)
    return await handler.get_detail(session, student_id)


@router.get("", response_model=StudentPage, response_model_by_alias=True)
async def list_students(
    session: Session,
    _: Actor,
    school_id: uuid.UUID | None = None,
    grade: Annotated[int | None, Query(ge=1, le=12)] = None,
    class_id: uuid.UUID | None = None,
    gender: Annotated[str | None, Query(pattern="^(MALE|FEMALE)$")] = None,
    product: str | None = None,
    size: str | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> StudentPage:
    filters = handler.ListFilters(
        school_id, grade, class_id, gender, product, size, q, page, page_size
    )
    return await handler.list_students(session, filters)


@router.get("/{student_id}", response_model=StudentDetail, response_model_by_alias=True)
async def get_student(student_id: uuid.UUID, session: Session, _: Actor) -> StudentDetail:
    return await handler.get_detail(session, student_id)


@router.put("/{student_id}", response_model=StudentDetail, response_model_by_alias=True)
async def update_student(
    student_id: uuid.UUID, payload: StudentIn, session: Session, actor: Actor
) -> StudentDetail:
    await handler.update_student(session, student_id, payload, actor)
    return await handler.get_detail(session, student_id)


@router.delete("/{student_id}", status_code=204)
async def delete_student(student_id: uuid.UUID, session: Session, actor: Actor) -> Response:
    await handler.delete_student(session, student_id, actor)
    return Response(status_code=204)
