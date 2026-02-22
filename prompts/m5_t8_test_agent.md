# M5-T8 Test Agent Prompt - PM Task Creation via Tasks API

## Mission
Add and harden automated tests for M5-T8 so PM task creation is fully covered across backend role/validation behavior and frontend PM UX.

Scope for this run: **M5-T8-ST5 through M5-T8-ST6**.

## Expected implementation surface to validate
- Backend:
  - `POST /api/v1/tasks` now enforces PM/Admin constraints for project-scoped creation.
  - Deterministic error behavior for unauthorized and invalid payload paths.
  - PM-created tasks are linked so they appear in project task flow (`GET /api/v1/projects/{project_id}/tasks`).
- Frontend:
  - PM project page (`ProjectDetailPage`) has create-task entry point/form.
  - Form submits to tasks API via PM client helper.
  - UI handles loading/success/error states with clear messaging.

## Existing patterns to reuse
- Backend auth/role test style:
  - `backend/tests/api/test_plans.py`
  - `backend/tests/api/test_auth_dependency.py`
- Backend project/task API style:
  - `backend/tests/api/test_projects_api.py`
  - `backend/tests/api/test_task_reasoning_logs.py`
- Frontend PM page test style:
  - `frontend/src/pages/ProjectDetailPage.test.tsx`

## Required backend coverage (M5-T8-ST5)
1. Happy path
- PM (or project owner/admin role) can create task for project context.
- Response includes expected task fields.
- Created task is discoverable through project task listing flow.

2. Authorization path
- Non-PM/non-admin (for same project) is denied task creation.
- User without project access is denied/not-found per established contract.

3. Validation/error path
- Missing required fields (title/task_type) produce deterministic validation response.
- Invalid project context payload (if contract includes project_id/team_id coupling) returns deterministic error.

4. Regression/safety
- Existing non-project or legacy task creation behavior (if intentionally preserved) is covered minimally.

## Required frontend coverage (M5-T8-ST6)
1. Happy path
- PM can open create-task UI, submit valid form, and task board refresh is triggered.
- Success feedback is shown.

2. Validation path
- Required fields guard in UI and/or surfaced backend 422 message is visible to user.

3. Authorization/error path
- Permission-denied API response shows clear non-technical error message.
- Existing task board rendering remains functional.

4. Loading state
- Submit button disabled or loading indicator appears during mutation.

## Likely file targets
- Backend:
  - `backend/tests/api/test_projects_api.py` (or new dedicated `test_tasks_create_pm_flow.py`)
- Frontend:
  - `frontend/src/pages/ProjectDetailPage.test.tsx`
  - optionally new PM API test file if needed

## Constraints
- Deterministic tests only.
- Mock external integrations/network.
- Keep assertions focused on API contract and user-visible outcomes.

## Quality gates to run
- `cd backend && .venv/bin/pytest`
- `cd frontend && npm run lint && npm run build && npm run test`

## Required task/doc updates
- Update `TASKS.md` only for subtasks fully completed.
- Document remaining gaps explicitly if full coverage is blocked.

## Output format
Provide:
1. Tests added/updated by file.
2. Coverage map vs ST5/ST6 requirements.
3. Commands run + pass/fail.
4. Remaining gaps/risks.
