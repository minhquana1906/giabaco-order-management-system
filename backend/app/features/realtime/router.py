import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.events import bus
from app.core.security import require_admin

router = APIRouter(prefix="/api", tags=["realtime"], dependencies=[Depends(require_admin)])

PING_INTERVAL_SECONDS = 15.0


async def event_stream(ping_interval: float = PING_INTERVAL_SECONDS) -> AsyncIterator[str]:
    """Yield SSE frames: `changed` events with topic names only, `: ping` when idle."""
    async with bus.subscribe() as queue:
        while True:
            try:
                topics = await asyncio.wait_for(queue.get(), timeout=ping_interval)
            except TimeoutError:
                yield ": ping\n\n"
                continue
            yield f"event: changed\ndata: {json.dumps({'topics': sorted(topics)})}\n\n"


@router.get("/events")
async def events() -> StreamingResponse:
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
