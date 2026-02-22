"""Tests for project API endpoints."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.auth import get_current_user
from src.api.projects import (
    start_task,
    create_task,
    create_project,
    get_project,
    list_projects,
    list_project_tasks,
    list_project_allowed_agents,
    add_project_allowed_agent,
    list_task_reasoning_logs,
)
from src.api.schemas import ProjectCreate, TaskCreate, TaskStartRequest
from src.core.state import AgentStatus, TaskStatus, PlanStatus, UserRole
from src.main import create_app
from src.storage.database import get_db
from src.storage.models import Agent, Plan, Project, Task, TaskReasoningLog, TeamMember, User


async def _make_user(db: AsyncSession, username: str, email: str) -> User:
    user = User(
        id=str(uuid4()),
        username=username,
        email=email,
        hashed_password="hashed",
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    await db.flush()
    return user


async def _make_agent(db: AsyncSession, owner: User) -> Agent:
    agent = Agent(
        id=str(uuid4()),
        name="Test Agent",
        role="coder",
        inference_endpoint="https://test.example.com",
        owner_id=owner.id,
        status=AgentStatus.ONLINE,
    )
    db.add(agent)
    await db.flush()
    return agent


async def _make_task(db: AsyncSession, owner: User, team_id: str | None = None) -> Task:
    task = Task(
        id=str(uuid4()),
        title="Reasoning Task",
        task_type="code_generation",
        status=TaskStatus.PENDING,
        created_by_id=owner.id,
        team_id=team_id,
    )
    db.add(task)
    await db.flush()
    return task


async def _make_project_member(
    db: AsyncSession,
    user: User,
    project: Project,
    role: UserRole,
) -> TeamMember:
    team_member = TeamMember(
        id=str(uuid4()),
        user_id=user.id,
        project_id=project.id,
        role=role.value,
    )
    db.add(team_member)
    await db.flush()
    return team_member


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


@pytest.mark.asyncio
async def test_list_projects_returns_workspace_projects(db_session: AsyncSession):
    owner = await _make_user(db_session, "owner_user", "owner@example.com")
    viewer = await _make_user(db_session, "viewer_user", "viewer@example.com")

    project_a_id = str(uuid4())
    project_b_id = str(uuid4())

    db_session.add(
        Project(
            id=project_a_id,
            name="Workspace Project A",
            owner_id=owner.id,
        )
    )
    db_session.add(
        Project(
            id=project_b_id,
            name="Workspace Project B",
            owner_id=owner.id,
        )
    )
    # Add viewer as a team member to both projects
    db_session.add(
        TeamMember(
            id=str(uuid4()),
            project_id=project_a_id,
            user_id=viewer.id,
        )
    )
    db_session.add(
        TeamMember(
            id=str(uuid4()),
            project_id=project_b_id,
            user_id=viewer.id,
        )
    )
    await db_session.commit()


class TestProjects:
    @pytest.mark.asyncio
    async def test_create_project(self, db_session: AsyncSession):
        user = await _make_user(db_session, "creator", "creator@test.com")
        await db_session.commit()

        project = await create_project(
            project_data=ProjectCreate(
                name="New Project",
                description="A test project",
                goals=["Ship fast"],
            ),
            current_user=user,
            db=db_session,
        )

        assert project.name == "New Project"
        assert project.owner_id == user.id
        assert project.goals == ["Ship fast"]

    @pytest.mark.asyncio
    async def test_list_projects_returns_owned(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "owner_user", "owner@example.com")
        await db_session.commit()

        db_session.add(Project(id=str(uuid4()), name="Project A", owner_id=owner.id))
        db_session.add(Project(id=str(uuid4()), name="Project B", owner_id=owner.id))
        await db_session.commit()

        projects = await list_projects(current_user=owner, db=db_session)
        names = {p.name for p in projects}

        assert "Project A" in names
        assert "Project B" in names

    @pytest.mark.asyncio
    async def test_list_projects_returns_member_projects(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "proj_owner", "proj_owner@test.com")
        member = await _make_user(db_session, "proj_member", "proj_member@test.com")
        project = Project(id=str(uuid4()), name="Member Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.flush()

        tm = TeamMember(
            id=str(uuid4()),
            user_id=member.id,
            project_id=project.id,
            role="developer",
        )
        db_session.add(tm)
        await db_session.commit()

        projects = await list_projects(current_user=member, db=db_session)
        names = {p.name for p in projects}

        assert "Member Project" in names

    @pytest.mark.asyncio
    async def test_get_project(self, db_session: AsyncSession):
        user = await _make_user(db_session, "getter", "getter@test.com")
        await db_session.commit()

        project = await create_project(
            project_data=ProjectCreate(name="Get Me"),
            current_user=user,
            db=db_session,
        )

        fetched = await get_project(project_id=project.id, current_user=user, db=db_session)

        assert fetched.id == project.id

    @pytest.mark.asyncio
    async def test_get_project_not_found(self, db_session: AsyncSession):
        user = await _make_user(db_session, "nope", "nope@test.com")
        await db_session.commit()

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await get_project(project_id="nonexistent", current_user=user, db=db_session)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_list_project_tasks(self, db_session: AsyncSession):
        user = await _make_user(db_session, "task_owner", "task_owner@test.com")
        project = Project(id=str(uuid4()), name="Task Project", owner_id=user.id)
        db_session.add(project)

        task = Task(
            id=str(uuid4()),
            title="Linked Task",
            task_type="code_generation",
            status=TaskStatus.PENDING,
            created_by_id=user.id,
        )
        db_session.add(task)
        await db_session.flush()

        plan = Plan(
            id=str(uuid4()),
            task_id=task.id,
            project_id=project.id,
            plan_data={"steps": ["do thing"]},
            status=PlanStatus.DRAFT.value,
        )
        db_session.add(plan)
        await db_session.commit()

        tasks = await list_project_tasks(project_id=project.id, current_user=user, db=db_session)

        assert len(tasks) == 1
        assert tasks[0].title == "Linked Task"

    @pytest.mark.asyncio
    async def test_list_project_tasks_includes_direct_project_scoped_tasks(
        self, db_session: AsyncSession
    ):
        user = await _make_user(db_session, "task_owner_2", "task_owner_2@test.com")
        project = Project(id=str(uuid4()), name="Task Project 2", owner_id=user.id)
        db_session.add(project)

        task = Task(
            id=str(uuid4()),
            title="Direct Project Task",
            task_type="code_generation",
            status=TaskStatus.PENDING,
            created_by_id=user.id,
            team_id=project.id,
        )
        db_session.add(task)
        await db_session.commit()

        tasks = await list_project_tasks(project_id=project.id, current_user=user, db=db_session)

        assert len(tasks) == 1
        assert tasks[0].title == "Direct Project Task"


class TestTaskCreation:
    @pytest.fixture(autouse=True)
    def _mock_orchestrator_generate_plan(self, monkeypatch: pytest.MonkeyPatch):
        class _NoopEventBus:
            async def publish(self, *args, **kwargs):  # noqa: ANN002, ANN003
                return None

        class _MockOrchestrator:
            async def generate_plan(self, *args, **kwargs):  # noqa: ANN002, ANN003
                task_id = kwargs["task_id"]
                project_id = kwargs["project_id"]
                db = kwargs["db"]
                plan = Plan(
                    id=str(uuid4()),
                    task_id=task_id,
                    project_id=project_id,
                    status=PlanStatus.PENDING_PM_APPROVAL.value,
                    plan_data={"steps": ["mocked-step"]},
                )
                db.add(plan)
                return {"plan_id": plan.id, "status": PlanStatus.PENDING_PM_APPROVAL.value}

        monkeypatch.setattr(
            "src.core.orchestrator.get_orchestrator",
            lambda: _MockOrchestrator(),
        )
        monkeypatch.setattr(
            "src.api.projects.get_event_bus",
            lambda: _NoopEventBus(),
        )

    @pytest.mark.asyncio
    async def test_create_task_allows_project_owner_with_project_context(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "proj_owner_create", "proj_owner_create@test.com")
        project = Project(id=str(uuid4()), name="Owner Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="Create from PM flow",
                description="Owner creates task",
                task_type="bug_fix",
                project_id=project.id,
            ),
            current_user=owner,
            db=db_session,
        )

        assert task.title == "Create from PM flow"
        assert task.team_id == project.id

    @pytest.mark.asyncio
    async def test_create_task_generates_pending_plan_for_project_scope(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "plan_owner", "plan_owner@test.com")
        project = Project(id=str(uuid4()), name="Plan Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="Plan-first task",
                task_type="bug_fix",
                project_id=project.id,
            ),
            current_user=owner,
            db=db_session,
        )

        plan_result = await db_session.execute(select(Plan).where(Plan.task_id == task.id))
        plan = plan_result.scalar_one_or_none()

        assert plan is not None
        assert plan.project_id == project.id
        assert plan.status == PlanStatus.PENDING_PM_APPROVAL.value
        assert task.status not in {TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED}

    @pytest.mark.asyncio
    async def test_create_task_returns_500_when_plan_generation_fails(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "fail_owner", "fail_owner@test.com")
        project = Project(id=str(uuid4()), name="Fail Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        class _FailingOrchestrator:
            async def generate_plan(self, *args, **kwargs):  # noqa: ANN002, ANN003
                raise RuntimeError("plan generation failed")

        with patch(
            "src.core.orchestrator.get_orchestrator",
            return_value=_FailingOrchestrator(),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await create_task(
                    task_data=TaskCreate(
                        title="Task with failing plan generation",
                        task_type="bug_fix",
                        project_id=project.id,
                    ),
                    current_user=owner,
                    db=db_session,
                )

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == "Task creation failed while generating OA plan."

        task_result = await db_session.execute(
            select(Task).where(Task.title == "Task with failing plan generation")
        )
        assert task_result.scalar_one_or_none() is None

    @pytest.mark.asyncio
    async def test_create_task_allows_pm_member_with_project_context(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "pm_owner", "pm_owner@test.com")
        pm_user = await _make_user(db_session, "pm_member", "pm_member@test.com")
        project = Project(id=str(uuid4()), name="PM Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.flush()
        await _make_project_member(db_session, pm_user, project, UserRole.PM)
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="PM scoped task",
                task_type="code_generation",
                project_id=project.id,
            ),
            current_user=pm_user,
            db=db_session,
        )

        assert task.team_id == project.id
        assert task.created_by_id == pm_user.id

    @pytest.mark.asyncio
    async def test_create_task_allows_admin_member_with_project_context(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "admin_owner", "admin_owner@test.com")
        admin_user = await _make_user(db_session, "admin_member", "admin_member@test.com")
        project = Project(id=str(uuid4()), name="Admin Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.flush()
        await _make_project_member(db_session, admin_user, project, UserRole.ADMIN)
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="Admin scoped task",
                task_type="code_review",
                project_id=project.id,
            ),
            current_user=admin_user,
            db=db_session,
        )

        assert task.team_id == project.id
        assert task.created_by_id == admin_user.id

    @pytest.mark.asyncio
    async def test_create_task_rejects_non_pm_member(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "project_owner", "project_owner@test.com")
        developer = await _make_user(db_session, "dev_member", "dev_member@test.com")
        project = Project(id=str(uuid4()), name="Protected Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.flush()
        await _make_project_member(db_session, developer, project, UserRole.DEVELOPER)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await create_task(
                task_data=TaskCreate(
                    title="Unauthorized task",
                    task_type="code_generation",
                    project_id=project.id,
                ),
                current_user=developer,
                db=db_session,
            )

        assert exc_info.value.status_code == 403
        assert "PM or Admin" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_create_task_hides_inaccessible_project(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "private_owner", "private_owner@test.com")
        outsider = await _make_user(db_session, "outsider", "outsider@test.com")
        project = Project(id=str(uuid4()), name="Private Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await create_task(
                task_data=TaskCreate(
                    title="Hidden project task",
                    task_type="code_generation",
                    project_id=project.id,
                ),
                current_user=outsider,
                db=db_session,
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_create_task_rejects_mismatched_project_and_team_id(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "mismatch_owner", "mismatch_owner@test.com")
        project = Project(id=str(uuid4()), name="Mismatch Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await create_task(
                task_data=TaskCreate(
                    title="Mismatched IDs",
                    task_type="bug_fix",
                    project_id=project.id,
                    team_id=str(uuid4()),
                ),
                current_user=owner,
                db=db_session,
            )

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail == "project_id and team_id must match when both are provided"

    @pytest.mark.asyncio
    async def test_create_task_keeps_legacy_non_project_flow(self, db_session: AsyncSession):
        user = await _make_user(db_session, "legacy_user", "legacy_user@test.com")
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="Legacy task",
                task_type="documentation",
            ),
            current_user=user,
            db=db_session,
        )

        assert task.created_by_id == user.id
        assert task.team_id is None

    @pytest.mark.asyncio
    async def test_start_task_blocks_before_pm_start_signal(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "start_gate_owner", "start_gate_owner@test.com")
        project = Project(id=str(uuid4()), name="Start Gate Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        task = await create_task(
            task_data=TaskCreate(
                title="Blocked start task",
                task_type="code_generation",
                project_id=project.id,
            ),
            current_user=owner,
            db=db_session,
        )

        with patch(
            "src.services.agent_assignment.assign_agent_to_task",
            new=AsyncMock(return_value={"assigned_agent_id": None}),
        ) as assign_mock:
            with pytest.raises(HTTPException) as exc_info:
                await start_task(
                    task_id=task.id,
                    request=TaskStartRequest(project_id=project.id),
                    background_tasks=BackgroundTasks(),
                    current_user=owner,
                    db=db_session,
                )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Task cannot start before PM approval/start signal."
        assign_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_create_task_is_discoverable_in_project_task_listing(
        self, db_session: AsyncSession
    ):
        owner = await _make_user(db_session, "discover_owner", "discover_owner@test.com")
        project = Project(id=str(uuid4()), name="Discoverable Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        created = await create_task(
            task_data=TaskCreate(
                title="Discoverable task",
                task_type="refactor",
                project_id=project.id,
            ),
            current_user=owner,
            db=db_session,
        )

        tasks = await list_project_tasks(project.id, current_user=owner, db=db_session)

        assert [task.id for task in tasks] == [created.id]

    @pytest.mark.asyncio
    async def test_create_task_api_returns_422_for_missing_required_fields(
        self, db_session: AsyncSession, api_client
    ):
        owner = await _make_user(db_session, "api_owner", "api_owner@test.com")
        await db_session.commit()

        client, context = api_client
        context["current_user"] = owner

        response = await client.post(
            "/api/v1/tasks", json={"description": "missing title and type"}
        )

        assert response.status_code == 422
        payload = response.json()
        missing_fields = sorted(
            entry["loc"][-1] for entry in payload["detail"] if entry.get("type") == "missing"
        )
        assert missing_fields == ["task_type", "title"]

    @pytest.mark.asyncio
    async def test_create_task_api_returns_422_for_mismatched_project_and_team_id(
        self, db_session: AsyncSession, api_client
    ):
        owner = await _make_user(db_session, "api_owner_2", "api_owner_2@test.com")
        project = Project(id=str(uuid4()), name="API Project", owner_id=owner.id)
        db_session.add(project)
        await db_session.commit()

        client, context = api_client
        context["current_user"] = owner

        response = await client.post(
            "/api/v1/tasks",
            json={
                "title": "Mismatch via API",
                "task_type": "bug_fix",
                "project_id": project.id,
                "team_id": str(uuid4()),
            },
        )

        assert response.status_code == 422
        assert (
            response.json()["detail"] == "project_id and team_id must match when both are provided"
        )


class TestProjectAllowlist:
    @pytest.mark.asyncio
    async def test_add_and_list_allowed_agent(self, db_session: AsyncSession):
        user = await _make_user(db_session, "allow_owner", "allow@test.com")
        project = Project(id=str(uuid4()), name="Allow Project", owner_id=user.id)
        db_session.add(project)
        agent = await _make_agent(db_session, user)
        await db_session.commit()

        allowed = await add_project_allowed_agent(
            project_id=project.id,
            agent_id=agent.id,
            current_user=user,
            db=db_session,
        )

        assert allowed.project_id == project.id
        assert allowed.agent_id == agent.id

        # List should return it
        agents = await list_project_allowed_agents(
            project_id=project.id, current_user=user, db=db_session
        )

        assert len(agents) == 1


class TestTaskReasoningLogs:
    @pytest.mark.asyncio
    async def test_list_reasoning_logs_orders_by_sequence(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "log_owner", "log_owner@test.com")
        task = await _make_task(db_session, owner)
        await db_session.flush()

        db_session.add_all(
            [
                TaskReasoningLog(
                    id=str(uuid4()),
                    task_id=task.id,
                    event_type="task.started",
                    message="Started",
                    status="in_progress",
                    sequence=2,
                    payload={},
                    source="orchestrator",
                ),
                TaskReasoningLog(
                    id=str(uuid4()),
                    task_id=task.id,
                    event_type="task.assigned",
                    message="Assigned",
                    status="in_progress",
                    sequence=1,
                    payload={},
                    source="orchestrator",
                ),
            ]
        )
        await db_session.commit()

        logs = await list_task_reasoning_logs(task_id=task.id, current_user=owner, db=db_session)

        assert len(logs) == 2
        assert [log.sequence for log in logs] == [1, 2]

    @pytest.mark.asyncio
    async def test_list_reasoning_logs_denies_other_user(self, db_session: AsyncSession):
        owner = await _make_user(db_session, "owner_u", "owner_u@test.com")
        outsider = await _make_user(db_session, "outsider_u", "outsider_u@test.com")
        task = await _make_task(db_session, owner)
        await db_session.commit()

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await list_task_reasoning_logs(task_id=task.id, current_user=outsider, db=db_session)

        assert exc_info.value.status_code == 404
