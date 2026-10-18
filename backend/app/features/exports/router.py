from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.exports import handler

Session = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/api/export", tags=["exports"], dependencies=[Depends(require_admin)])

STUDENTS_SHEET = "Học sinh"
TRIALS_SHEET = "Lần thử"


def _download(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _file(dataset: handler.Dataset, fmt: str, name: str, sheet: str) -> Response:
    if fmt == "csv":
        return _download(handler.to_csv(*dataset), handler.CSV_MEDIA_TYPE, f"{name}.csv")
    return _download(handler.to_xlsx({sheet: dataset}), handler.XLSX_MEDIA_TYPE, f"{name}.xlsx")


@router.get("/students.{fmt}")
async def export_students(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.students_dataset(session), fmt, "students", STUDENTS_SHEET)


@router.get("/trials.{fmt}")
async def export_trials(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.trials_dataset(session), fmt, "trials", TRIALS_SHEET)


@router.get("/all.xlsx")
async def export_all(session: Session) -> Response:
    content = handler.to_xlsx(
        {
            STUDENTS_SHEET: await handler.students_dataset(session),
            TRIALS_SHEET: await handler.trials_dataset(session),
        }
    )
    return _download(content, handler.XLSX_MEDIA_TYPE, "all.xlsx")
