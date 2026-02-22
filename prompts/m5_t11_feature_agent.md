# M5-T11 Feature Agent Prompt - OA Plan-First Flow with PM Start Signal Gate

## Mission
Implement M5-T11 behavior so **new project-scoped tasks** automatically trigger OA plan generation first, then **wait for PM start signal** (approval) before any implementation execution begins.

Scope for this run: **M5-T11-ST1 through M5-T11-ST4** only.

## Required alignment
Follow and preserve contracts in:
- `PROJECT_SPEC.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `TESTING.md`

Do not silently change unrelated architecture contracts.

## M5-T11 required behavior
1. When a new task is created, OA gets a signal and generates a plan artifact.
2. The plan is persisted in `pending_pm_approval` state.
3. Implementation agents must not start before PM start signal.
4. PM start signal (approval) transitions flow to active assignment/execution.

## Current repo reality (must use)

### Task creation and events
- Task create endpoint: `backend/src/api/projects.py` (`@tasks_router.post("")` -> `create_task(...)`)
- It currently publishes `EventType.TASK_CREATED`, but there is no subscriber that generates plans.
- Project-scoped tasks currently use `project_id`/`team_id` equivalence; PM/Admin/owner role enforcement exists.

### Planning today
- Explicit plan generation API exists: `POST /api/v1/plans/generate` in `backend/src/api/plans.py`.
- OA plan generator exists in `backend/src/core/orchestrator.py`:
  - `Orchestrator.generate_plan(...)` already persists `Plan(status=pending_pm_approval)`.

### Approval/start today
- PM approval API exists: `POST /api/v1/plans/{id}/approve` in `backend/src/api/plans.py`.
- Approval currently updates plan status + audit only.
- Execution paths:
  - background scheduler: `backend/src/services/task_scheduler.py` processes tasks with `APPROVED` plans.
  - manual task start endpoint: `POST /api/v1/tasks/{task_id}/start` in `backend/src/api/projects.py`.

### Frontend PM flow today
- PM dashboard page: `frontend/src/pages/ProjectDetailPage.tsx`
- PM actions include approve/reject plan and create task, but no explicit “approve+start” semantics in UX copy/state.

## Subtask implementation goals

### 1. M5-T11-ST1 - Auto plan generation on task creation (backend)
Add deterministic plan generation trigger for newly created **project-scoped** tasks.

Minimum behavior:
- On successful `POST /api/v1/tasks` with project scope:
  - trigger OA plan generation (`Orchestrator.generate_plan`) and persist plan artifact.
  - resulting plan status is `pending_pm_approval`.
- Preserve current auth/validation and response stability.
- Ensure failures in plan generation are surfaced in stable way (no silent partial success ambiguity).

Recommended direction:
- Prefer explicit in-process call from `create_task(...)` using DB session + orchestrator helper.
- If using event bus (`task.created`) subscriber, guarantee deterministic persistence and error handling.

### 2. M5-T11-ST2 - PM approval becomes deterministic start signal (backend)
Ensure PM approval starts execution flow reliably.

Minimum behavior:
- `POST /plans/{id}/approve` should not only set status; it should trigger assignment/execution transition for that plan’s task.
- Transition must be deterministic and auditable.
- Must keep the “no execution before approval” guarantee.

Implementation options:
- call scheduler helper (`process_single_task`) directly on approval, OR
- publish and consume dedicated start event with strict ordering.

Guardrails:
- no duplicate starts from repeated approval calls.
- no start when plan status not eligible.
- preserve `404/400` contracts already in approval endpoint.

### 3. M5-T11-ST3 - PM frontend start-signal UX
Update PM plan action UX in `ProjectDetailPage`:
- Action text/copy should communicate approval is also start signal.
- Clear pending/loading/success/error behavior for start-triggering approval.
- Refresh PM/task data after action so state transitions are visible.

### 4. M5-T11-ST4 - Frontend lifecycle rendering consistency
Ensure PM/task views reflect plan-first lifecycle:
- After task creation, UI should show plan pending approval state before execution states.
- Execution states should appear only after PM approval/start.
- Keep current tabs/layout patterns; no visual regressions.

## Data/contract constraints
- Keep `PlanStatus` values intact (`pending_pm_approval`, `approved`, etc.).
- Keep existing role checks (`require_pm_role_for_project`) and project-scoped access semantics.
- Maintain backward compatibility for legacy non-project task creation where intended.

## Suggested file targets
- Backend:
  - `backend/src/api/projects.py`
  - `backend/src/api/plans.py`
  - `backend/src/core/orchestrator.py`
  - `backend/src/services/task_scheduler.py`
  - optional event wiring in `backend/src/main.py` / `backend/src/core/event_bus.py`
- Frontend:
  - `frontend/src/pages/ProjectDetailPage.tsx`
  - `frontend/src/lib/pmApi.ts`
  - `frontend/src/lib/types.ts`
  - optionally related API hooks in `frontend/src/lib/api.ts`

## Acceptance checks for implementer
- Creating a new project-scoped task generates and persists OA plan artifact immediately.
- Created plan is `pending_pm_approval` and visible in PM dashboard pending approvals.
- No implementation run begins before PM approval/start signal.
- PM approval triggers active execution flow automatically.
- Frontend clearly reflects “approve/start” semantics and updated state.

## Testing expectation for this run
- Add only minimal smoke tests needed for touched behavior.
- Full coverage hardening is handled in test-agent stage (M5-T11-ST5/ST6).

## Required task/doc updates
- Update `TASKS.md` status only for subtasks fully completed.
- If API/workflow contract behavior changes, update `PROJECT_SPEC.md` and `ARCHITECTURE.md` in same PR per `AGENTS.md`.

## Output format
Provide:
1. Changed files list.
2. Behavior delta summary (before/after).
3. API/event flow summary.
4. Commands/tests run.
5. Open risks/follow-ups for test-agent and review-agent.
