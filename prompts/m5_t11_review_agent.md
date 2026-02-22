# M5-T11 Review Agent Prompt - Plan-First Orchestration Gate Review

## Mission
Perform a PR-style risk review for M5-T11 changes with focus on correctness, execution gating, authorization safety, and regression risk.

Scope for this run: **M5-T11-ST7**.

## M5-T11 objective
For new tasks, OA must generate a plan first and wait for PM start signal (approval) before execution. After PM signal, execution should start automatically and reliably.

## Expected touched areas
- Backend:
  - `backend/src/api/projects.py` (task creation flow)
  - `backend/src/api/plans.py` (approval/start transition)
  - `backend/src/core/orchestrator.py` (plan generation path)
  - `backend/src/services/task_scheduler.py` (start dispatch behavior)
  - optional event wiring in `backend/src/main.py` / `backend/src/core/event_bus.py`
- Frontend:
  - `frontend/src/pages/ProjectDetailPage.tsx`
  - `frontend/src/lib/pmApi.ts`
  - `frontend/src/lib/types.ts`
- Tests:
  - `backend/tests/api/...` covering create->plan and approve->start
  - `frontend/src/pages/ProjectDetailPage.test.tsx` for PM UX/state
- Docs/tasks:
  - `TASKS.md`
  - `PROJECT_SPEC.md` / `ARCHITECTURE.md` if contracts changed

## Review checklist

1. Execution gating correctness
- New project-scoped task deterministically results in persisted pending plan artifact.
- No implementation execution starts pre-approval.
- PM approval deterministically starts execution flow.
- No duplicate starts / race conditions from scheduler + direct start trigger overlap.

2. Authorization/security
- PM/Admin/owner constraints remain enforced on relevant actions.
- No privilege escalation path introduced by new start behavior.
- Project isolation preserved; no cross-project task/plan execution leakage.

3. Contract stability
- Error contracts for task creation/plan approval remain deterministic (`404/403/400/422` where relevant).
- Existing workflows (legacy non-project task creation, existing approvals) not regressed.

4. Data integrity
- Plan-to-task/project linkage remains valid.
- No orphan plans or duplicated plan artifacts per create action.
- Task status progression and timestamps remain coherent.

5. Frontend behavior/regressions
- PM action labeling and state messages match start-signal semantics.
- Loading/error/success behavior is clear and prevents accidental duplicate actions.
- Existing PM tabs and task board flows remain stable.

6. Tests and quality gates
- Backend tests cover create->plan, no-start-before-approval, approve->start, and edge/error paths.
- Frontend tests cover lifecycle visibility and approval/start UX states.
- Quality gates pass:
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
