"""API-level tests for task reasoning logs snapshot and SSE endpoints (M5-T4-ST6)."""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import get_current_user
from src.api.projects import list_task_reasoning_logs, stream_task_reasoning_logs
from src.core.reasoning_logs import get_reasoning_stream_hub
from src.core.state import TaskStatus, UserRole
from src.main import create_app
from src.storage.database import get_db
from src.storage.models import Project, Task, TaskReasoningLog, TeamMember, User


def _make_user(db: AsyncSession, suffix: str) -> User:
    user = User(
        id=str(uuid4()),
        email=f"{suffix}-{uuid4().hex[:6]}@example.com",
        username=f"{suffix}-{uuid4().hex[:6]}",
        hashed_password="fakehash",
    )
    db.add(user)
    return user


async def _make_project(db: AsyncSession, owner_id: str) -> Project:
    project = Project(
        id=str(uuid4()),
        name="Reasoning Test Project",
        description="Project for reasoning log API tests",
        goals=["Test reasoning logs"],
        timeline={"start": "2026-02-22"},
        owner_id=owner_id,
    )
    db.add(project)
    await db.flush()
    return project


async def _add_membership(
    db: AsyncSession, *, user_id: str, project_id: str, role: str = UserRole.DEVELOPER.value
) -> TeamMember:
    membership = TeamMember(
        id=str(uuid4()),
        user_id=user_id,
        project_id=project_id,
        role=role,
        skills=[],
        capacity=1.0,
        current_load=0.0,
    )
    db.add(membership)
    await db.flush()
    return membership


async def _make_task(db: AsyncSession, *, owner: User, team_id: str | None = None) -> Task:
    task = Task(
        id=str(uuid4()),
        title="Reasoning API Task",
        task_type="code_generation",
        status=TaskStatus.PENDING,
        created_by_id=owner.id,
        team_id=team_id,
    )
    db.add(task)
    await db.flush()
    return task


@dataclass
class _FakeRequest:
    disconnected: bool = False

    async def is_disconnected(self) -> bool:
        return self.disconnected


def _decode_chunk(chunk: str | bytes) -> str:
    if isinstance(chunk, bytes):
        return chunk.decode("utf-8")
    return chunk


@pytest.fixture(autouse=True)
def _reset_reasoning_hub():
    hub = get_reasoning_stream_hub()
    hub._subscribers.clear()  # noqa: SLF001 - explicit cleanup of in-memory singleton for test isolation
    yield
    hub._subscribers.clear()  # noqa: SLF001 - explicit cleanup of in-memory singleton for test isolation


@pytest.fixture
async def api_client(db_session: AsyncSession):
    app = create_app()
    context: dict[str, User | None] = {"current_user": None}

    async def override_get_db():
        yield db_session

    async def override_get_current_user() -> User:
        user = context["current_user"]
        if user is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client, context

    app.dependency_overrides.clear()


async def test_reasoning_logs_snapshot_returns_stable_order_and_required_fields(
    db_session: AsyncSession,
    api_client: tuple[AsyncClient, dict[str, User | None]],
):
    client, context = api_client
    owner = _make_user(db_session, "owner")
    project = await _make_project(db_session, owner.id)
    task = await _make_task(db_session, owner=owner, team_id=project.id)
    context["current_user"] = owner

    db_session.add_all(
        [
            TaskReasoningLog(
                id=str(uuid4()),
                task_id=task.id,
                event_type="task.completed",
                message="Task finished",
                status="completed",
                sequence=2,
                payload={"step": "done"},
                source="orchestrator",
                created_at=datetime(2026, 2, 22, 12, 0, tzinfo=timezone.utc),
            ),
            TaskReasoningLog(
                id=str(uuid4()),
                task_id=task.id,
                event_type="task.started",
                message="Task started",
                status="in_progress",
                sequence=1,
                payload={"step": "start"},
                source="orchestrator",
                created_at=datetime(2026, 2, 22, 11, 59, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.commit()

    response = await client.get(f"/api/v1/tasks/{task.id}/reasoning-logs")
    assert response.status_code == 200
    body = response.json()

    assert [entry["sequence"] for entry in body] == [1, 2]
    required_fields = {
        "id",
        "task_id",
        "subtask_id",
        "event_type",
        "message",
        "status",
        "sequence",
        "payload",
        "source",
        "created_at",
    }
    assert required_fields.issubset(body[0].keys())
    assert body[0]["message"] == "Task started"
    assert body[1]["message"] == "Task finished"


async def test_reasoning_logs_snapshot_denies_user_without_access(
    db_session: AsyncSession,
    api_client: tuple[AsyncClient, dict[str, User | None]],
):
    client, context = api_client
    owner = _make_user(db_session, "owner")
    outsider = _make_user(db_session, "outsider")
    task = await _make_task(db_session, owner=owner)
    await db_session.commit()

    context["current_user"] = outsider
    response = await client.get(f"/api/v1/tasks/{task.id}/reasoning-logs")

    assert response.status_code == 404
    assert response.json()["detail"] == "Task not found"


async def test_reasoning_logs_snapshot_returns_empty_list_when_no_history(
    db_session: AsyncSession,
    api_client: tuple[AsyncClient, dict[str, User | None]],
):
    client, context = api_client
    owner = _make_user(db_session, "owner")
    task = await _make_task(db_session, owner=owner)
    await db_session.commit()

    context["current_user"] = owner
    response = await client.get(f"/api/v1/tasks/{task.id}/reasoning-logs")

    assert response.status_code == 200
    assert response.json() == []


async def test_reasoning_logs_snapshot_handles_unknown_event_payload_shapes(
    db_session: AsyncSession,
    api_client: tuple[AsyncClient, dict[str, User | None]],
):
    client, context = api_client
    owner = _make_user(db_session, "owner")
    project = await _make_project(db_session, owner.id)
    await _add_membership(db_session, user_id=owner.id, project_id=project.id, role=UserRole.PM.value)
    task = await _make_task(db_session, owner=owner, team_id=project.id)
    context["current_user"] = owner

    db_session.add(
        TaskReasoningLog(
            id=str(uuid4()),
            task_id=task.id,
            event_type="task.unknown_vendor_event",
            message="Unknown event payload",
            status="info",
            sequence=1,
            payload={"nested": {"arbitrary": [1, "two", {"k": "v"}]}, "flag": True},
            source="unknown-source",
            created_at=datetime(2026, 2, 22, 13, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    response = await client.get(f"/api/v1/tasks/{task.id}/reasoning-logs")
    assert response.status_code == 200
    body = response.json()

    assert len(body) == 1
    assert body[0]["event_type"] == "task.unknown_vendor_event"
    assert body[0]["payload"]["nested"]["arbitrary"][2]["k"] == "v"


async def test_reasoning_log_stream_sends_sse_event_with_expected_format(db_session: AsyncSession):
    owner = _make_user(db_session, "owner")
    task = await _make_task(db_session, owner=owner)
    await db_session.commit()

    request = _FakeRequest(disconnected=False)
    response = await stream_task_reasoning_logs(
        task_id=task.id,
        request=request,  # type: ignore[arg-type]
        current_user=owner,
        db=db_session,
    )
    assert response.media_type == "text/event-stream"

    stream = response.body_iterator
    connected_chunk = _decode_chunk(await anext(stream))
    assert connected_chunk == ": connected\n\n"

    stream_payload = {
        "event": "reasoning_log.created",
        "log": {
            "id": str(uuid4()),
            "task_id": task.id,
            "subtask_id": None,
            "event_type": "task.progress",
            "message": "Step 1 finished",
            "status": "in_progress",
            "sequence": 1,
            "payload": {"step": 1, "total_steps": 2},
            "source": "orchestrator",
            "created_at": "2026-02-22T13:10:00Z",
        },
    }
    await get_reasoning_stream_hub().publish(task.id, stream_payload)
    event_chunk = _decode_chunk(await asyncio.wait_for(anext(stream), timeout=1.0))

    assert "event: reasoning_log.created\n" in event_chunk
    assert event_chunk.startswith("event: reasoning_log.created\ndata: ")
    payload_json = event_chunk.split("data: ", 1)[1].strip()
    payload = json.loads(payload_json)
    assert payload["event"] == "reasoning_log.created"
    assert payload["log"]["task_id"] == task.id
    assert payload["log"]["message"] == "Step 1 finished"

    request.disconnected = True
    with pytest.raises(StopAsyncIteration):
        await asyncio.wait_for(anext(stream), timeout=1.0)


async def test_reasoning_log_stream_handles_client_disconnect_without_crash(db_session: AsyncSession):
    owner = _make_user(db_session, "owner")
    task = await _make_task(db_session, owner=owner)
    await db_session.commit()

    request = _FakeRequest(disconnected=True)
    response = await stream_task_reasoning_logs(
        task_id=task.id,
        request=request,  # type: ignore[arg-type]
        current_user=owner,
        db=db_session,
    )
    stream = response.body_iterator

    connected_chunk = _decode_chunk(await anext(stream))
    assert connected_chunk == ": connected\n\n"
    with pytest.raises(StopAsyncIteration):
        await asyncio.wait_for(anext(stream), timeout=1.0)

    hub = get_reasoning_stream_hub()
    assert task.id not in hub._subscribers  # noqa: SLF001 - verifying cleanup for disconnected streams


async def test_reasoning_log_stream_access_denied_for_unauthorized_user(db_session: AsyncSession):
    owner = _make_user(db_session, "owner")
    outsider = _make_user(db_session, "outsider")
    task = await _make_task(db_session, owner=owner)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc:
        await stream_task_reasoning_logs(
            task_id=task.id,
            request=_FakeRequest(disconnected=False),  # type: ignore[arg-type]
            current_user=outsider,
            db=db_session,
        )

    assert exc.value.status_code == 404
