# M5-T4 Feature Agent Prompt - Real-Time OA Reasoning Logs in Frontend

## Mission
Implement M5-T4 functional behavior for real-time OA reasoning/action logs, aligned with `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `AGENTS.md`, and `TESTING.md`.

Scope for this run: **M5-T4-ST1 through M5-T4-ST5** only.

## Current repo reality (must use)
- Backend has an in-memory event bus (`backend/src/core/event_bus.py`) with task lifecycle events:
  - `task.started`, `task.assigned`, `task.progress`, `task.completed`, `task.failed`.
- Orchestrator publishes lifecycle events (`backend/src/core/orchestrator.py`) but these are not persisted or exposed to frontend.
- Task routes currently provide CRUD/read, but no reasoning log endpoints (`backend/src/api/projects.py`, `tasks_router`).
- Frontend Task Detail page (`frontend/src/pages/TaskDetailPage.tsx`) currently shows tabs for `Subtasks`, `Overview`, `Draft`, `Risks`; no live reasoning timeline.
- Frontend API layer (`frontend/src/lib/api.ts`, `frontend/src/hooks/use-api.ts`, `frontend/src/lib/types.ts`) has no reasoning-log types or streaming helpers.

## Architecture constraints to respect
- Keep existing auth/access patterns:
  - Backend routes use `get_current_user` and membership/ownership checks (see `get_task` in `backend/src/api/projects.py`).
- Do not replace existing task/subtask/plan behavior; extend it.
- Keep event bus semantics intact (pub/sub remains in-memory), but add persistence/read path for UI.
- Keep API shape explicit and deterministic for frontend consumption.

## Subtasks
1. **M5-T4-ST1 (Backend persistence for reasoning events)**
- Persist orchestration event timeline for task runs.
- Add a DB model (or equivalent persisted structure) for log entries with at minimum:
  - `id`, `task_id`, optional `subtask_id`, `event_type`, `message/summary`, `status`, `sequence`, `payload`, `created_at`, `source`.
- Add backend wiring so published task lifecycle events become persisted records.
- Ensure ordering is stable (sequence or timestamp + deterministic tie-break).

2. **M5-T4-ST2 (Backend snapshot + stream APIs)**
- Add authenticated task reasoning log read endpoints (under tasks router).
- Suggested contracts:
  - `GET /api/v1/tasks/{task_id}/reasoning-logs` (history snapshot)
  - `GET /api/v1/tasks/{task_id}/reasoning-logs/stream` (SSE stream of new entries)
- Enforce same access guard as `GET /api/v1/tasks/{task_id}`.
- Return payloads that include machine-usable status so UI can distinguish in-progress vs completed steps.
- Keep stream format simple and typed (event name + JSON payload).

3. **M5-T4-ST3 (Frontend API/types + streaming hook)**
- Add TS types in `frontend/src/lib/types.ts` for reasoning log entries and stream events.
- Add API helpers in `frontend/src/lib/api.ts` (or a dedicated `reasoningApi.ts` module if cleaner):
  - fetch history
  - subscribe to SSE stream
- Add a React hook (query + stream merger) in `frontend/src/hooks/use-api.ts` or dedicated hook file.
- Ensure cleanup/reconnect behavior does not leak event listeners.

4. **M5-T4-ST4 (Task Detail reasoning timeline UI)**
- Add a new section/tab in `frontend/src/pages/TaskDetailPage.tsx` for reasoning logs.
- Render incrementally as events arrive.
- Clearly distinguish step states:
  - in progress (active)
  - completed
  - failed (if emitted)
- Handle empty/loading/error states cleanly.

5. **M5-T4-ST5 (Live run refresh behavior)**
- Ensure active task runs receive new events without full-page reload.
- Keep UI resilient if stream disconnects (non-blocking warning + ability to continue with last snapshot or reconnect).
- Avoid hard coupling to mocked data; integrate with real backend endpoints.

## File targets (likely)
- Backend:
  - `backend/src/storage/models.py` (new reasoning log model)
  - `backend/src/core/event_bus.py` (if event subscription hook needed)
  - `backend/src/core/orchestrator.py` (only minimal event payload enhancements if required)
  - `backend/src/api/projects.py` (task reasoning log routes on `tasks_router`)
  - `backend/src/api/schemas.py` (response schemas)
  - `backend/src/main.py` (if stream router wiring changes are needed)
- Frontend:
  - `frontend/src/lib/types.ts`
  - `frontend/src/lib/api.ts` (or `frontend/src/lib/reasoningApi.ts`)
  - `frontend/src/hooks/use-api.ts` (or dedicated reasoning hook)
  - `frontend/src/pages/TaskDetailPage.tsx`

## Acceptance checks for implementer
- Task detail page shows reasoning events in chronological order.
- During an active run, new log rows appear incrementally.
- Completed events are visually distinct from in-progress rows.
- Unauthorized access to another team/task logs is denied by backend.

## Testing expectations (implementer-owned smoke)
- Add/update tests only if directly needed by your code touches; broad coverage is handled by test-agent.
- At minimum run touched-area smoke checks if feasible.

## Required task/doc updates
- Update `TASKS.md` statuses only for subtasks you fully complete.
- If behavior contracts change (new API/event contract), update `PROJECT_SPEC.md` and `ARCHITECTURE.md` in the same PR per `AGENTS.md`.

## Output format
Provide:
1. Changed files list.
2. New/updated API contracts (snapshot + stream).
3. UI behavior summary (including in-progress/completed distinction).
4. Tests run.
5. Open risks/follow-ups for test-agent/review-agent.
