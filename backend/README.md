# Backend

Python API for the HackEurope orchestration platform.

## Scope
- Task orchestration and assignment planning
- Hosted agent execution orchestration
- Reviewer checks on GitHub commit events
- Marketplace APIs
- Billing integrations (Stripe + Paid.ai)

## Structure
- `src/api/` - API routes and schemas
- `src/core/` - orchestration and event flow
- `src/services/` - marketplace/stripe/paid integrations
- `src/storage/` - DB models and database setup
- `src/agents/` - example agent implementations
- `tests/` - backend tests

## Run
```bash
cd backend
uv sync
uv run python -m src.main
```

## Test
```bash
cd backend
pytest
```

See root `AGENTS.md` and `TESTING.md` for shared team rules.
