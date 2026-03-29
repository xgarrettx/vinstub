# VINSTUB API

A commercial REST API that returns VIN stubs (WMI + VDS prefix) for a given year, make, model, and optional submodel. Used by software teams building vehicle history tools, insurance platforms, and inventory management systems.

---

## Architecture

```
monorepo/
├── apps/
│   └── api/          — Fastify 4 API server (Node 22, TypeScript ESM)
├── packages/
│   └── shared/       — Shared types and plan constants
docker-compose.yml    — Local Postgres 16 + Redis 7
```

**Stack:** Node.js 22 · Fastify 4 · TypeScript (strict, NodeNext) · PostgreSQL 16 (Drizzle ORM) · Redis 7 (ioredis) · Stripe · Resend · Sentry · pnpm workspaces + Turborepo

---

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9 (`npm install -g pnpm`)
- Docker Desktop (for local Postgres + Redis)
- A Stripe account (test mode keys)
- A Resend account (free tier works for dev)

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/vinstub.git
cd vinstub
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
# Starts postgres:5432 and redis:6379 with health checks
```

### 3. Configure environment

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env — fill in all required values (see .env.example for format)
```

Minimum required for local dev:
```
DATABASE_URL=postgresql://vinstub:vinstub@localhost:5432/vinstub
REDIS_URL=redis://localhost:6379
JWT_SECRET=<any 32+ char random string>
REFRESH_SECRET=<different 32+ char random string>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...     # from stripe listen output
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PREMIUM=price_...
STRIPE_PRICE_ENTERPRISE=price_...
RESEND_API_KEY=re_...
APP_BASE_URL=http://localhost:3000
ADMIN_API_KEY=<any secret>
ADMIN_TOTP_SECRET=<base32 secret>   # generate: npx otpauth generate
```

### 4. Run database migrations

```bash
pnpm --filter @vinstub/api db:migrate
```

### 5. Start the API server

```bash
pnpm --filter @vinstub/api dev
# Server starts at http://localhost:8080
# Swagger docs at http://localhost:8080/docs
```

### 6. Forward Stripe webhooks (separate terminal)

```bash
stripe listen --forward-to localhost:8080/webhooks/stripe
# Copy the whsec_... signing secret into STRIPE_WEBHOOK_SECRET
```

---

## API Reference

Interactive docs are served at `/docs` (Swagger UI).

### Authentication

All `/v1/*` endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer vs_live_<48 hex chars>
```

API keys are issued upon email verification and can be rotated via the dashboard.

### Core Endpoint

```
GET /v1/stub?year=2022&make=Toyota&model=Camry&submodel=LE
```

**Query parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `year` | Yes | Model year (1980–2035) |
| `make` | Yes | Vehicle make (synonyms resolved: "chevy" → "chevrolet") |
| `model` | Yes | Vehicle model |
| `submodel` | No | Trim/submodel. When omitted, the base model record is returned |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "vin_stub": "1HGCM826",
    "stub_length": 8,
    "year": 2022,
    "make": "Honda",
    "model": "Accord",
    "submodel": "EX",
    "match_type": "exact"
  }
}
```

`match_type` is `"exact"` when a submodel was matched, `"base_model"` when no submodel was provided.

**Rate limit headers (on every response):**
```
X-RateLimit-Limit-Day: 500
X-RateLimit-Remaining-Day: 482
X-RateLimit-Reset-Day: 1719619200
X-RateLimit-Limit-Minute: 20
X-RateLimit-Remaining-Minute: 17
X-RateLimit-Reset-Minute: 1719532920
X-Soft-Cap-Exceeded: true        # paid plans only, when daily soft cap hit
```

### Rate Limits by Plan

| Plan | Requests/Day | Requests/Hour | Requests/Min |
|------|-------------|---------------|--------------|
| Free | 50 (hard) | 30 | 5 |
| Basic | 500 (soft) | 200 | 20 |
| Premium | 5,000 (soft) | 2,000 | 100 |
| Enterprise | 50,000 (soft) | 15,000 | 500 |

Soft cap: request is allowed but `X-Soft-Cap-Exceeded: true` is returned.

### Other Endpoints

```
GET  /v1/makes                     — List all makes (cached)
GET  /v1/models?make=Toyota        — List models for a make (cached)
GET  /v1/account                   — Your account info and limits (Bearer)
POST /v1/account/rotate-key        — Generate a new API key (JWT)
POST /v1/account/revoke-key        — Deactivate API key (JWT)
GET  /v1/account/billing           — Stripe Customer Portal URL (JWT)
GET  /v1/account/usage?days=30     — Usage history (JWT)
POST /v1/account/checkout?plan=    — Create upgrade checkout session (JWT)
GET  /v1/health                    — Health check (public)
```

### Auth Endpoints

```
POST /auth/register
GET  /auth/verify-email?token=
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
```

---

## Data Import

VIN stub data is imported from CSV files using the ingest script.

**CSV format** (required columns):

| Column | Type | Example |
|--------|------|---------|
| `year` | integer | `2022` |
| `make` | string | `Toyota` |
| `model` | string | `Camry` |
| `submodel` | string or empty | `LE` |
| `vin_stub` | 7–17 char string | `4T1B11HK` |
| `is_base_model` | boolean | `true` / `false` |
| `source_version` | string | `2024-Q2` |

**Rules:**
- `is_base_model=true` → `submodel` must be empty
- `is_base_model=false` → `submodel` must be non-empty
- VIN stub characters: A-Z, 0-9 (no I, O, or Q per VIN spec)

**Import commands:**

```bash
# Validate only (no DB writes)
pnpm --filter @vinstub/api ingest --file ./data/stubs.csv --dry-run

# Live import
pnpm --filter @vinstub/api ingest --file ./data/stubs.csv

# Custom batch size (default 500)
pnpm --filter @vinstub/api ingest --file ./data/stubs.csv --batch-size 1000
```

The script upserts rows on `(year, make_normalized, model_normalized, submodel_normalized)` and deactivates rows from previous `source_version` values. Redis caches are rebuilt after each successful import.

---

## Admin API

Internal ops endpoints require two headers on every request:

```
X-Admin-Key: <ADMIN_API_KEY from env>
X-Admin-TOTP: <current 6-digit TOTP code>
```

Endpoints:
```
GET    /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id/plan
POST   /admin/users/:id/suspend
POST   /admin/users/:id/unsuspend
POST   /admin/users/:id/reset-usage
GET    /admin/stats
```

To generate an `ADMIN_TOTP_SECRET`:
```bash
node -e "const {authenticator} = require('otplib'); console.log(authenticator.generateSecret())"
```

Then scan the QR code into your authenticator app:
```bash
node -e "const {authenticator} = require('otplib'); const s = 'YOUR_SECRET'; console.log('otpauth://totp/VINSTUB?secret=' + s + '&issuer=VINSTUB')"
```

---

## Background Jobs

All jobs run in-process via `node-cron`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `sync-usage` | Every 60s | Redis daily counters → Postgres |
| `suspend-accounts` | Every 15min | Grace period enforcement (72h) |
| `payment-reminders` | Every hour | Reminder emails at 24h and 48h |

Jobs are started in `server.ts` after the server is ready and stopped gracefully on SIGTERM.

---

## Deployment (DigitalOcean App Platform)

1. Push to GitHub main branch
2. App Platform picks up `apps/api` as the Node.js service
3. Set all environment variables in App Platform settings
4. Run `pnpm --filter @vinstub/api db:migrate` as a run-once Job before first deploy
5. Configure the managed Postgres and Redis add-ons
6. Set the Stripe webhook endpoint to `https://api.vinstub.com/webhooks/stripe`

**Build command:** `pnpm install --frozen-lockfile && pnpm --filter @vinstub/api build`
**Run command:** `node apps/api/dist/server.js`

---

## Testing

```bash
pnpm --filter @vinstub/api test
pnpm --filter @vinstub/api test:watch
```

Tests use Vitest. Integration tests require a running Postgres + Redis (use `docker compose up -d`).

---

## Project Scripts

From the repo root:

```bash
pnpm dev          # Start all apps in dev mode (Turborepo)
pnpm build        # Build all packages
pnpm typecheck    # TypeScript check across all packages
pnpm test         # Run all tests
```
