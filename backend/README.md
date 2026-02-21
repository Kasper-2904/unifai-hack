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
- `src/skills/` - skill markdown files for agent prompts
- `tests/` - backend tests

## Setup

### 1. Install dependencies
```bash
cd backend
uv sync
```

### 2. Create `.env` file
```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Seed the database
```bash
uv run python scripts/seed_db.py
```

### 4. Run the server
```bash
uv run python -m src.main
```

## Test
```bash
uv run python -m pytest tests/ -v
```

## Environment Variables

See `.env.example` for all required variables.

### Stripe Setup (Test Mode)

1. **Create Stripe account** at [stripe.com](https://stripe.com)

2. **Enable Test Mode** (toggle in top-right of dashboard)

3. **Get API Keys:**
   - Go to: `Developers → API keys`
   - Copy **Secret key** (starts with `sk_test_`)
   ```
   STRIPE_SECRET_KEY=sk_test_xxxxx
   ```

4. **Setup Webhooks:**

   **Option A: Local development with Stripe CLI**
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe
   
   # Login to Stripe
   stripe login
   
   # Forward webhooks to local server
   stripe listen --forward-to localhost:8000/api/v1/billing/webhook
   ```
   The CLI will output a webhook secret starting with `whsec_`

   **Option B: Production/Deployed server**
   - Go to: `Developers → Webhooks → Add endpoint`
   - URL: `https://your-domain.com/api/v1/billing/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `account.updated`
   - After creating, click the webhook → copy **Signing secret**
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```


### Stripe Billing Flow

**For Sellers:**
1. `POST /api/v1/billing/onboard-seller` → Returns Stripe onboarding URL
2. Complete onboarding on Stripe's page
3. `GET /api/v1/billing/seller-status` → Check account status

**For Buyers:**
1. `GET /api/v1/marketplace/catalog` → Browse agents
2. `POST /api/v1/billing/purchase-agent/{id}` → Get checkout URL (paid) or instant subscribe (free)
3. Complete payment on Stripe's checkout page
4. Webhook activates subscription automatically

## API Documentation

When running locally, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

See root `AGENTS.md` and `TESTING.md` for shared team rules.
