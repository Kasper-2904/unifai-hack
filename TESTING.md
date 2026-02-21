# Testing (Shared Standard)

This file defines the minimum unit-test standard for the team.

## Required
- Every behavior change must include unit tests, or explicit rationale why not.
- Tests must be deterministic.
- External systems must be mocked (GitHub, Stripe, Paid.ai, network).

## Minimum Coverage Per Change
- Happy path
- Error/validation path
- Authorization path (when relevant)

## Test Locations
- Backend: `backend/tests/`
- Frontend: `frontend/src/` tests (`*.test.ts` / `*.test.tsx`)

## PR Test Note
Each PR must include:
- Tests added/updated
- Commands run
- Remaining gaps (if any)
