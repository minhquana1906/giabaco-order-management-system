import logging
import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.order_pivot import campaign_or_404
from app.core.security import require_admin
from app.features.exports import handler

Session = Annotated[AsyncSession, Depends(get_session)]

router = APIRouter(prefix="/api/export", tags=["exports"], dependencies=[Depends(require_admin)])
logger = logging.getLogger("app.exports")

TRIALS_SHEET = "Lần thử"
SURVEYS_SHEET = "Khảo sát"
CAMPAIGN_ORDERS_SHEET = "Bảng kê đơn"
CAMPAIGN_PIVOT_SHEET = "Ma trận"
CAMPAIGN_TAILOR_SHEET = "May đo"


def _download(content: bytes, media_type: str, filename: str, rows: int) -> Response:
    logger.info(
        "exports.generated",
        extra={
            "ctx": {
                "kind": filename.rsplit(".", 1)[0],
                "format": filename.rsplit(".", 1)[1],
                "rows": rows,
            }
        },
    )
    return Response(
        content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _row_count(sheets: dict[str, handler.Dataset]) -> int:
    return sum(len(rows) for _, rows in sheets.values())


def _file(dataset: handler.Dataset, fmt: str, name: str, sheet: str) -> Response:
    if fmt == "csv":
        return _download(
            handler.to_csv(*dataset), handler.CSV_MEDIA_TYPE, f"{name}.csv", len(dataset[1])
        )
    return _download(
        handler.to_xlsx({sheet: dataset}), handler.XLSX_MEDIA_TYPE, f"{name}.xlsx", len(dataset[1])
    )


@router.get("/students.{fmt}")
async def export_students(
    fmt: Literal["csv", "xlsx"], session: Session, school_id: uuid.UUID | None = None
) -> Response:
    if fmt == "csv":
        dataset = await handler.students_dataset(session, school_id)
        return _download(
            handler.to_csv(*dataset), handler.CSV_MEDIA_TYPE, "hoc-sinh.csv", len(dataset[1])
        )
    sheets = await handler.student_datasets(session, school_id)
    return _download(
        handler.to_xlsx(sheets), handler.XLSX_MEDIA_TYPE, "hoc-sinh.xlsx", _row_count(sheets)
    )


@router.get("/trials.{fmt}")
async def export_trials(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.trials_dataset(session), fmt, "lan-thu", TRIALS_SHEET)


@router.get("/surveys.{fmt}")
async def export_surveys(fmt: Literal["csv", "xlsx"], session: Session) -> Response:
    return _file(await handler.surveys_dataset(session), fmt, "khao-sat", SURVEYS_SHEET)


@router.get("/all.xlsx")
async def export_all(session: Session) -> Response:
    sheets = {
        **await handler.student_datasets(session),
        TRIALS_SHEET: await handler.trials_dataset(session),
    }
    return _download(
        handler.to_xlsx(sheets), handler.XLSX_MEDIA_TYPE, "tat-ca.xlsx", _row_count(sheets)
    )


@router.get("/campaign-orders.xlsx")
async def export_campaign_orders(
    campaign_id: uuid.UUID, session: Session, submitted_until: date | None = None
) -> Response:
    campaign = await campaign_or_404(session, campaign_id)
    sheets = {
        CAMPAIGN_ORDERS_SHEET: await handler.campaign_orders_dataset(
            session, campaign_id, submitted_until
        ),
        CAMPAIGN_PIVOT_SHEET: await handler.campaign_pivot_dataset(
            session, campaign_id, submitted_until
        ),
    }
    tailor = await handler.campaign_tailor_dataset(session, campaign_id, submitted_until)
    if tailor[1]:
        sheets[CAMPAIGN_TAILOR_SHEET] = tailor
    content = handler.to_xlsx(sheets, titles=dict.fromkeys(sheets, campaign.name))
    return _download(content, handler.XLSX_MEDIA_TYPE, "don-dang-ky.xlsx", _row_count(sheets))
