# M5-T8 Review Agent Prompt - PM Task Creation Flow Risk Review

## Mission
Perform a PR-style review of M5-T8 changes focusing on correctness, role security, regressions, and missing tests.

Scope for this run: **M5-T8-ST7**.

## M5-T8 objective
PM users must be able to create tasks through PM UI using `POST /api/v1/tasks`, with proper authorization and clear validation/error UX.

## Expected touched areas
- Backend:
  - tasks create endpoint (`backend/src/api/projects.py`)
  - request schema changes (`backend/src/api/schemas.py`) if project context is added
  - role helper usage (`backend/src/api/auth.py`) for PM/Admin checks
  - project task listing/linkage behavior for newly created tasks
- Frontend:
  - PM project detail task-create UI (`frontend/src/pages/ProjectDetailPage.tsx`)
  - PM API helper (`frontend/src/lib/pmApi.ts`)
  - task-create types (`frontend/src/lib/types.ts`)
- Tests:
  - backend task creation auth/validation/linkage coverage
  - frontend PM create-task flow coverage
- Docs/tasks:
  - `TASKS.md` status updates for completed M5-T8 subtasks
  - `PROJECT_SPEC.md` / `ARCHITECTURE.md` updates if API contract changed

## Review checklist
1. Authorization/security
- PM/Admin role enforcement is correct for project-scoped create-task.
- No privilege escalation path lets developer-only users create PM-scoped tasks.
- No cross-project leakage from task creation/listing behavior.

2. Contract correctness
- `POST /api/v1/tasks` payload/response contracts are explicit and stable.
- Validation and auth errors are deterministic and not overexposed.
- Backward compatibility is preserved where intended.

3. Data/linkage correctness
- Newly PM-created tasks reliably appear in PM project task flow.
- No duplicate task entries or orphan link records are introduced.

4. UI behavior and regressions
- PM task-create entry point is usable in `ProjectDetailPage`.
- Success/error/loading states are clear.
- Existing PM tabs/flows (plans/settings/task board navigation) are not regressed.

5. Tests and quality gates
- Backend tests cover happy/auth/validation/linkage paths.
- Frontend tests cover happy/error/loading paths.
- Quality gates run clean:
  - `cd backend && .venv/bin/pytest`
  - `cd frontend && npm run lint && npm run build && npm run test`

## Output format (mandatory)
1. Findings first, ordered by severity:
- `High` / `Medium` / `Low`
- include file reference and line where possible
- explain impact and recommended fix
2. Open questions/assumptions
3. Brief change summary
4. Quality gate status

If no findings, state that explicitly and include residual risks/testing gaps.
