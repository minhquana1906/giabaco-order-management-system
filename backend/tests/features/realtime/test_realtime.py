import asyncio
import json
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import bus
from app.features.realtime.router import event_stream, events


async def test_events_require_session(anon_client: Any) -> None:
    response = await anon_client.get("/api/events")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


async def test_response_headers() -> None:
    response = await events()

    assert response.media_type == "text/event-stream"
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    await response.body_iterator.aclose()  # type: ignore[union-attr]


async def test_frame_contains_only_topic_names() -> None:
    stream = event_stream()
    before = len(bus._queues)
    pending = asyncio.ensure_future(anext(stream))
    while len(bus._queues) == before:
        await asyncio.sleep(0)

    bus.publish("students", "choices")
    frame = await asyncio.wait_for(pending, 1)

    head, data = frame.rstrip("\n").split("\n")
    assert head == "event: changed"
    assert frame.endswith("\n\n")
    assert json.loads(data.removeprefix("data: ")) == {"topics": ["choices", "students"]}
    await stream.aclose()


async def test_ping_when_idle_and_unsubscribe_on_close() -> None:
    before = len(bus._queues)
    stream = event_stream(ping_interval=0.01)

    assert await asyncio.wait_for(anext(stream), 1) == ": ping\n\n"
    assert len(bus._queues) == before + 1

    await stream.aclose()
    assert len(bus._queues) == before


async def test_publish_only_after_successful_commit(client: Any, student_payload: Any) -> None:
    async with bus.subscribe() as queue:
        created = await client.post("/api/students", json=student_payload())
        assert created.status_code == 201
        assert queue.get_nowait() == {"students"}


async def test_no_publish_when_commit_fails(
    client: Any, student_payload: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def failing_commit(self: AsyncSession) -> None:
        raise IntegrityError("INSERT", {}, Exception("violates uq_fitting_trials_active"))

    monkeypatch.setattr(AsyncSession, "commit", failing_commit)
    async with bus.subscribe() as queue:
        response = await client.post("/api/students", json=student_payload())

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "duplicate_trial"
        assert queue.empty()
