"""In-memory change-signal bus (single process)."""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager


class EventBus:
    """Fan-out of topic sets to subscriber queues."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue[set[str]]] = set()

    def publish(self, *topics: str) -> None:
        """Non-blocking publish; call only after commit."""
        if not topics:
            return
        for queue in self._queues:
            queue.put_nowait(set(topics))

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[set[str]]]:
        """Register a queue for the duration of the context."""
        queue: asyncio.Queue[set[str]] = asyncio.Queue()
        self._queues.add(queue)
        try:
            yield queue
        finally:
            self._queues.discard(queue)


bus = EventBus()
