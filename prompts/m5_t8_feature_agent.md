# M5-T8 Feature Agent Prompt - PM Task Creation via Tasks API

## Mission
Implement M5-T8 functional behavior so PM users can create tasks end-to-end from PM UI using `POST /api/v1/tasks`, with explicit role enforcement and clear validation/error handling.

Scope for this run: **M5-T8-ST1 through M5-T8-ST4** only.

## Required alignment
Follow and preserve contracts in:
- `PROJECT_SPEC.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `TESTING.md`

Do not silently change unrelated architecture contracts.

## Current repo reality (must use)
- Backend task creation endpoint already exists:
  - `backend/src/api/projects.py`
  - `@tasks_router.post("")` -> `create_task(...)`
- Current `create_task` behavior has no PM role gate for project-scoped creation.
- PM role helper exists and is used by plans APIs:
  - `backend/src/api/auth.py` -> `require_pm_role_for_project(...)`
  - `backend/src/api/plans.py` uses this for approve/reject.
- PM UI page exists:
  - `frontend/src/pages/ProjectDetailPage.tsx`
  - Tasks tab currently displays board only; no create-task entry point.
- PM API client exists:
  - `frontend/src/lib/pmApi.ts`
  - currently no create-task helper.
- Tasks API helpers exist but are developer/general read focused:
  - `frontend/src/lib/api.ts`

## Implementation goals by subtask

### 1. M5-T8-ST1 (Backend role + contract hardening)
Add backend validation and role handling for PM task creation.

Minimum behavior:
- PM-scoped task creation must verify user is project owner, project PM/Admin member, or superuser.
- Non-PM/non-admin users must receive deterministic forbidden response.
- Invalid or inaccessible project context must return deterministic error response (prefer stable `404` for missing/inaccessible project and `403` for role mismatch where appropriate).

Notes:
- Reuse `require_pm_role_for_project(...)` where possible.
- If existing request payload lacks explicit project context for role checks, add the minimal contract extension needed (for example `project_id` in `TaskCreate`) and keep backward compatibility where feasible.

### 2. M5-T8-ST2 (Project linkage for PM-created tasks)
Ensure PM-created tasks appear in PM project task flow.

Current gap to solve:
- PM project board fetches tasks via `GET /api/v1/projects/{project_id}/tasks`.
- That endpoint currently resolves tasks through plan linkage.

Implement one deterministic linkage strategy and keep it explicit in code/docs/tests. Acceptable examples:
- create/link a plan record for newly PM-created tasks when project context is provided, or
- extend project-task listing query to include directly project-scoped tasks in addition to plan-linked tasks.

Whichever path you choose:
- Keep access constraints unchanged.
- Avoid breaking existing plan/task behavior.

### 3. M5-T8-ST3 (PM UI entry point)
Add PM task-creation UI entry point in `ProjectDetailPage` Tasks tab.

Minimum UX behavior:
- PM can open create-task UI (inline form, modal, or panel).
- Required fields: title + task type.
- Optional field: description.
- Project context is supplied automatically from route (`/projects/:id`).
- On success:
  - show success feedback,
  - refresh task board query (`project-tasks`).

### 4. M5-T8-ST4 (Frontend client/types + error UX)
Add frontend API wiring and robust UI state handling.

Expected updates:
- Add create-task request/response types in `frontend/src/lib/types.ts` (or dedicated PM types if cleaner).
- Add PM API helper in `frontend/src/lib/pmApi.ts` for create task.
- Handle loading/disable state on submit.
- Map backend auth/validation failures to clear non-technical copy (for example: permission denied, missing required field, invalid task type/project context).

## Suggested file targets
- Backend:
  - `backend/src/api/projects.py`
  - `backend/src/api/schemas.py`
  - `backend/src/api/auth.py` (reuse helpers, minimal additions only)
  - optional linkage touchpoints in task/project query code
- Frontend:
  - `frontend/src/pages/ProjectDetailPage.tsx`
  - `frontend/src/lib/pmApi.ts`
  - `frontend/src/lib/types.ts`

## Acceptance checks for implementer
- PM can create a task from PM project detail UI.
- Request is sent to `POST /api/v1/tasks` with project context.
- Unauthorized role receives clear denial behavior.
- Created task becomes visible in PM project task board flow.
- Validation/auth errors are clearly surfaced in UI.

## Testing expectations (implementer-owned smoke)
- Add/update only minimal tests needed for touched behavior.
- Full dedicated coverage is handled by test-agent (M5-T8-ST5/ST6).

## Required task/doc updates
- Update `TASKS.md` status only for subtasks fully completed.
- If API contracts change, update `PROJECT_SPEC.md` and `ARCHITECTURE.md` in the same PR per `AGENTS.md`.

## Output format
Provide:
1. Changed files list.
2. API contract summary (before/after where changed).
3. PM UI behavior summary.
4. Commands/tests run.
5. Open risks/follow-ups for test-agent and review-agent.
