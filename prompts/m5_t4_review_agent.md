# M5-T4 Review Agent Prompt - Real-Time OA Reasoning Logs Risk Review

## Mission
Perform a PR-style review of M5-T4 changes with focus on correctness, regressions, security, and missing tests.

Scope for this run: **M5-T4-ST8**.

## M5-T4 objective
Frontend task/detail views should show OA reasoning/action logs in near-real-time, with clear distinction between in-progress and completed reasoning steps.

## Expected touched areas
- Backend:
  - reasoning log persistence model and write path
  - task reasoning log snapshot endpoint
  - task reasoning log SSE stream endpoint
  - auth/access enforcement for log read endpoints
- Frontend:
  - reasoning log types/API client + stream hook
  - Task Detail UI timeline and stream lifecycle behavior
- Tests:
  - backend coverage for auth/happy/error/stream paths
  - frontend coverage for incremental rendering and failure handling
- Docs/tasks:
  - `TASKS.md` subtask status updates
  - `PROJECT_SPEC.md` / `ARCHITECTURE.md` updates if API contracts changed

## Review checklist
1. Contract correctness
- Snapshot and stream payloads are consistent and typed.
- Event ordering is deterministic.
- No breaking changes to existing task/detail APIs.

2. Authorization/security
- Access checks for reasoning logs mirror existing task access logic.
- No cross-project/team leakage through stream endpoints.

3. Data correctness
- Persisted events represent lifecycle transitions accurately.
- In-progress/completed/failed states are mapped consistently backend -> frontend.

4. Stream reliability
- SSE endpoint handles disconnects safely.
- Frontend reconnect/failure behavior is non-disruptive and does not duplicate rows excessively.

5. UI behavior and regressions
- Task Detail remains usable when stream is unavailable.
- Empty/loading/error states are explicit and user-friendly.
- Existing tabs/features (`Subtasks`, `Overview`, `Draft`, `Risks`) are not regressed.

6. Test adequacy
- Backend tests cover happy + auth + error/edge + stream path.
- Frontend tests cover incremental updates + status distinction + stream failure fallback.

## Output format (mandatory)
1. Findings first, ordered by severity:
- `High` / `Medium` / `Low`
- include file reference and line where possible
- explain user impact and recommended fix
2. Open questions/assumptions
3. Brief change summary
4. Quality gate status:
- `cd backend && .venv/bin/pytest`
- `cd frontend && npm run lint && npm run build && npm run test`

If no findings, state that explicitly and still list residual risks/testing gaps.
