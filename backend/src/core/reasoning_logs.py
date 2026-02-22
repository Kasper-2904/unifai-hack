"""Persistence and streaming helpers for task reasoning logs."""

import asyncio
import contextlib
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import TaskReasoningLogResponse
from src.core.event_bus import Event, EventBus, EventType
from src.storage.database import AsyncSessionLocal
from src.storage.models import TaskReasoningLog

TASK_LIFECYCLE_EVENTS: tuple[EventType, ...] = (
    EventType.TASK_STARTED,
    EventType.TASK_ASSIGNED,
    EventType.TASK_PROGRESS,
    EventType.TASK_COMPLETED,
    EventType.TASK_FAILED,
)

EVENT_STATUS_MAP: dict[EventType, str] = {
    EventType.TASK_STARTED: "in_progress",
    EventType.TASK_ASSIGNED: "in_progress",
    EventType.TASK_PROGRESS: "in_progress",
    EventType.TASK_COMPLETED: "completed",
    EventType.TASK_FAILED: "failed",
}


class ReasoningStreamHub:
    """In-memory pub/sub hub for task reasoning log SSE streams."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, task_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subscribers[task_id].add(queue)
        return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(task_id)
            if not subscribers:
                return
            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(task_id, None)

    async def publish(self, task_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            subscribers = list(self._subscribers.get(task_id, set()))

        for queue in subscribers:
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                with contextlib.suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
                with contextlib.suppress(asyncio.QueueFull):
                    queue.put_nowait(message)


_stream_hub: ReasoningStreamHub | None = None


def get_reasoning_stream_hub() -> ReasoningStreamHub:
    """Get the singleton reasoning stream hub."""
    global _stream_hub
    if _stream_hub is None:
        _stream_hub = ReasoningStreamHub()
    return _stream_hub


def _derive_status(event: Event) -> str:
    status = event.data.get("status")
    if isinstance(status, str) and status:
        return status
    return EVENT_STATUS_MAP.get(event.type, "info")


def _derive_message(event: Event) -> str:
    data = event.data

    for key in ("message", "summary"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    if event.type == EventType.TASK_ASSIGNED:
        agent_id = data.get("agent_id")
        skill = data.get("skill")
        if agent_id and skill:
            return f"Assigned {skill} to agent {agent_id}"
        if agent_id:
            return f"Assigned to agent {agent_id}"
        return "Task assigned"

    if event.type == EventType.TASK_PROGRESS:
        step = data.get("step")
        total_steps = data.get("total_steps")
        if isinstance(step, int) and isinstance(total_steps, int):
            return f"Completed step {step} of {total_steps}"
        if isinstance(step, int):
            return f"Completed step {step}"
        return "Task execution in progress"

    if event.type == EventType.TASK_STARTED:
        return "Task execution started"

    if event.type == EventType.TASK_COMPLETED:
        return "Task execution completed"

    if event.type == EventType.TASK_FAILED:
        return "Task execution failed"

    return event.type.value


def _normalize_timestamp(timestamp: datetime) -> datetime:
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp


def _to_response_payload(log: TaskReasoningLog) -> dict[str, Any]:
    return TaskReasoningLogResponse.model_validate(log).model_dump(mode="json")


async def persist_reasoning_event(event: Event, db_session: AsyncSession | None = None) -> None:
    """Persist task lifecycle events and broadcast them to active stream subscribers."""
    task_id = event.data.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        return

    if db_session is None:
        async with AsyncSessionLocal() as session:
            await _persist_reasoning_event_with_session(session, event)
        return

    await _persist_reasoning_event_with_session(db_session, event)


async def _persist_reasoning_event_with_session(session: AsyncSession, event: Event) -> None:
    task_id = event.data["task_id"]
    if not isinstance(task_id, str) or not task_id:
        return

    max_sequence_result = await session.execute(
        select(func.max(TaskReasoningLog.sequence)).where(TaskReasoningLog.task_id == task_id)
    )
    max_sequence = max_sequence_result.scalar_one_or_none() or 0

    log = TaskReasoningLog(
        id=str(uuid4()),
        task_id=task_id,
        subtask_id=event.data.get("subtask_id") if isinstance(event.data.get("subtask_id"), str) else None,
        event_type=event.type.value,
        message=_derive_message(event),
        status=_derive_status(event),
        sequence=max_sequence + 1,
        payload=event.data,
        source=event.source,
        created_at=_normalize_timestamp(event.timestamp),
    )
    session.add(log)
    await session.commit()
    await session.refresh(log)

    stream_payload = {
        "event": "reasoning_log.created",
        "log": _to_response_payload(log),
    }
    await get_reasoning_stream_hub().publish(task_id, stream_payload)


def register_reasoning_log_handlers(event_bus: EventBus) -> None:
    """Register event bus handlers for task lifecycle persistence."""
    for event_type in TASK_LIFECYCLE_EVENTS:
        event_bus.subscribe(event_type, persist_reasoning_event)
