# M5-T11 Test Agent Prompt - OA Plan-First + PM Start Signal Coverage

## Mission
Add and harden automated tests for M5-T11 to guarantee:
- task creation triggers OA planning first,
- no execution before PM start signal,
- PM approval/start triggers execution transition correctly.

Scope for this run: **M5-T11-ST5 through M5-T11-ST6**.

## Required alignment
Follow:
- `PROJECT_SPEC.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `TESTING.md`

Deterministic tests only; external integrations mocked.

## Expected implementation surface to validate

### Backend
- `POST /api/v1/tasks` for project-scoped tasks now triggers plan creation.
- Plan artifact persists as `pending_pm_approval` before execution.
- `POST /plans/{id}/approve` now acts as PM start signal and transitions task into execution flow.
- No execution path fires before approval.

### Frontend
- `ProjectDetailPage` plan action UX communicates approval/start semantics.
- Post-create/post-approve UI refresh reflects plan-first lifecycle.
- Loading/error/success states remain clear and stable.

## Existing patterns to reuse
- Backend API + role tests:
  - `backend/tests/api/test_projects_api.py`
  - `backend/tests/api/test_pm_dashboard.py`
  - `backend/tests/api/test_plans.py`
- Frontend PM view tests:
  - `frontend/src/pages/ProjectDetailPage.test.tsx`

## Required backend coverage (M5-T11-ST5)
1. Happy path: create -> plan pending
- Creating project-scoped task creates exactly one plan linked to task/project.
- Plan status is `pending_pm_approval`.
- Task is not in executing/completed state immediately after creation.

2. No-start-before-approval guarantee
- After task creation (before approval), execution state/events do not indicate started execution.
- Ensure scheduler/manual paths do not accidentally start task pre-approval.

3. Approval/start transition
- Approving pending plan transitions to approved and triggers task execution start path.
- Assert deterministic transition signal (task status progression, timestamps, or execution dispatch call outcome based on implementation).

4. Error/edge paths
- Approval of non-pending plan remains rejected with stable `400`.
- Missing plan remains `404`.
- Failed plan generation/start trigger path returns deterministic error contract.

## Required frontend coverage (M5-T11-ST6)
1. Plan-first visibility after task creation
- PM creates task and sees pending approval representation before active execution status.

2. Start-signal approval UX
- Approval action reflects “approve and start” semantics.
- Success state appears and relevant queries are refreshed.

3. Error/loading behavior
- Approval/start pending state disables repeat clicks.
- Backend approval/start failure shows clear non-technical message.
- Existing task board remains functional on errors.

## Likely file targets
- Backend:
  - `backend/tests/api/test_projects_api.py`
  - `backend/tests/api/test_pm_dashboard.py`
  - optional focused file e.g. `backend/tests/api/test_m5_t11_plan_start_gate.py`
- Frontend:
  - `frontend/src/pages/ProjectDetailPage.test.tsx`
  - optionally `frontend/src/lib/pmApi`-adjacent tests if added

## Quality gates to run
- `cd backend && .venv/bin/pytest`
- `cd frontend && npm run lint && npm run build && npm run test`

## Required task/doc updates
- Update `TASKS.md` only for fully completed subtasks.
- Document remaining gaps explicitly if any coverage is blocked.

## Output format
Provide:
1. Tests added/updated by file.
2. Coverage map vs ST5/ST6 requirements.
3. Commands run + pass/fail.
4. Remaining gaps/risks.
