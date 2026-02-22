"""Tests for reasoning log persistence helpers."""

from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.event_bus import Event, EventType
from src.core.reasoning_logs import persist_reasoning_event
from src.core.state import TaskStatus
from src.storage.models import Task, TaskReasoningLog, User


async def _make_user(db: AsyncSession) -> User:
    user = User(
        id=str(uuid4()),
        username=f"reasoning-user-{uuid4().hex[:6]}",
        email=f"reasoning-{uuid4().hex[:6]}@test.com",
        hashed_password="hashed",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _make_task(db: AsyncSession, owner: User) -> Task:
    task = Task(
        id=str(uuid4()),
        title="Reasoning Persistence Task",
        task_type="code_generation",
        status=TaskStatus.PENDING,
        created_by_id=owner.id,
    )
    db.add(task)
    await db.flush()
    return task


@pytest.mark.asyncio
async def test_persist_reasoning_event_creates_sequenced_logs(db_session: AsyncSession):
    owner = await _make_user(db_session)
    task = await _make_task(db_session, owner)
    await db_session.commit()

    await persist_reasoning_event(
        Event(
            type=EventType.TASK_STARTED,
            data={"task_id": task.id, "message": "Task started"},
            source="orchestrator",
        ),
        db_session=db_session,
    )
    await persist_reasoning_event(
        Event(
            type=EventType.TASK_COMPLETED,
            data={"task_id": task.id, "message": "Task completed", "status": "completed"},
            source="orchestrator",
        ),
        db_session=db_session,
    )

    result = await db_session.execute(
        select(TaskReasoningLog)
        .where(TaskReasoningLog.task_id == task.id)
        .order_by(TaskReasoningLog.sequence.asc())
    )
    logs = list(result.scalars().all())

    assert len(logs) == 2
    assert logs[0].sequence == 1
    assert logs[0].event_type == "task.started"
    assert logs[0].status == "in_progress"
    assert logs[1].sequence == 2
    assert logs[1].event_type == "task.completed"
    assert logs[1].status == "completed"
