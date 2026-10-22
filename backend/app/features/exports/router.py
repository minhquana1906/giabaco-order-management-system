import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_admin
from app.features.exports import handler

Session = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/api/export", tags=["exports"], dependencies=[Depends(require_admin)])

TRIALS_SHEET = "Lần thử"
SURVEYS_SHEET = "Khảo sát"
CAMPAIGN_ORDERS_SHEET = "Bảng kê đơn"
CAMPAIGN_PIVOT_SHEET = "Ma trận"


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
async def export_students(
    fmt: Literal["csv", "xlsx"], session: Session, school_id: uuid.UUID | None = None
) -> Response:
    if fmt == "csv":
        csv_bytes = handler.to_csv(*await handler.students_dataset(session, school_id))
        return _download(csv_bytes, handler.CSV_MEDIA_TYPE, "students.csv")
    sheets = await handler.student_datasets(session, school_id)
    return _download(handler.to_xlsx(sheets), handler.XLSX_MEDIA_TYPE, "students.xlsx")


@router.get("/trials.{fmt}")
async def export_trials(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.trials_dataset(session), fmt, "trials", TRIALS_SHEET)


@router.get("/surveys.{fmt}")
async def export_surveys(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.surveys_dataset(session), fmt, "surveys", SURVEYS_SHEET)


@router.get("/all.xlsx")
async def export_all(session: Session) -> Response:
    content = handler.to_xlsx(
        {
            **await handler.student_datasets(session),
            TRIALS_SHEET: await handler.trials_dataset(session),
        }
    )
    return _download(content, handler.XLSX_MEDIA_TYPE, "all.xlsx")


@router.get("/campaign-orders.xlsx")
async def export_campaign_orders(
    campaign_id: uuid.UUID, session: Session, submitted_until: date | None = None
) -> Response:
    content = handler.to_xlsx(
        {
            CAMPAIGN_ORDERS_SHEET: await handler.campaign_orders_dataset(
                session, campaign_id, submitted_until
            ),
            CAMPAIGN_PIVOT_SHEET: await handler.campaign_pivot_dataset(
                session, campaign_id, submitted_until
            ),
        }
    )
    return _download(content, handler.XLSX_MEDIA_TYPE, "campaign-orders.xlsx")
