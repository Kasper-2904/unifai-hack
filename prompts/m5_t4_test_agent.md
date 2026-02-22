# M5-T4 Test Agent Prompt - Real-Time OA Reasoning Logs

## Mission
Add and harden automated tests for M5-T4 real-time reasoning logs, covering backend persistence/streaming and frontend incremental UI behavior.

Scope for this run: **M5-T4-ST6 through M5-T4-ST7**.

## Context and expected implementation surface
- Backend expected changes (from feature implementation):
  - persisted reasoning log records for task lifecycle events
  - `GET /api/v1/tasks/{task_id}/reasoning-logs`
  - `GET /api/v1/tasks/{task_id}/reasoning-logs/stream` (SSE)
- Frontend expected changes:
  - reasoning log types + API helpers
  - stream-aware hook
  - Task Detail reasoning timeline UI with in-progress/completed distinction

## Existing test patterns to reuse
- Backend API/unit style examples:
  - `backend/tests/api/test_projects_api.py`
  - `backend/tests/api/test_subtasks.py`
  - `backend/tests/api/test_plans.py`
- Frontend page/hook style examples:
  - `frontend/src/pages/TaskDetailPage.test.tsx`
  - `frontend/src/pages/ContextExplorerPage.test.tsx`
  - `frontend/src/pages/BillingPage.test.tsx`

## Required backend coverage (M5-T4-ST6)
1. Happy path:
- reasoning logs are persisted and returned in stable order for a task.
- snapshot API includes required fields (status/event_type/message/timestamp/etc).

2. Authorization path:
- user without access to task receives denied/not-found behavior consistent with existing task access semantics.

3. Error/edge path:
- empty log history returns deterministic empty payload.
- malformed/unknown event payloads do not crash retrieval path.

4. Stream behavior:
- SSE endpoint returns correctly formatted events for new log entries.
- stream handles client disconnect/cancel without server crash.

## Required frontend coverage (M5-T4-ST7)
1. Happy path:
- Task Detail renders initial reasoning log history.
- incremental stream updates append new entries in order.
- in-progress vs completed visual/state indicators are distinct.

2. Error path:
- stream failure/disconnect surfaces a non-blocking UI message and preserves already loaded history.

3. Empty/loading path:
- empty timeline messaging is shown when no reasoning events exist.

4. Optional robustness:
- dedupe behavior when an event appears in both initial snapshot and stream.

## File targets (likely)
- Backend:
  - `backend/tests/api/test_projects_api.py` (or new `test_task_reasoning_logs.py`)
  - any fixtures/helpers needed in `backend/tests/`
- Frontend:
  - `frontend/src/pages/TaskDetailPage.test.tsx`
  - potentially new tests for reasoning hook/module

## Constraints
- Tests must be deterministic.
- Mock external dependencies.
- Avoid brittle timing assertions where possible.
- Keep assertions behavior-oriented (contract + user-visible outcomes).

## Quality gates to run
- `cd backend && .venv/bin/pytest`
- `cd frontend && npm run lint && npm run build && npm run test`

## Required task/doc updates
- Update `TASKS.md` statuses only for subtasks fully completed in this run.
- Document any untestable behavior and why.

## Output format
Provide:
1. Tests added/updated by file.
2. Coverage map vs ST6/ST7 requirements.
3. Commands run + pass/fail.
4. Remaining gaps/risks.
