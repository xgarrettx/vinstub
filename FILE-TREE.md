# VINSTUB.com — Project File Tree

```
VINStub/
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json                          # pnpm workspace root
├── turbo.json                            # Turborepo pipeline config
├── tsconfig.base.json                    # Shared TS base config
│
├── apps/
│   ├── api/                              # Fastify REST API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── app.ts                    # Fastify factory, plugin registration
│   │       ├── server.ts                 # Entry point — binds port, starts app
│   │       ├── openapi.ts                # Swagger / OpenAPI spec config
│   │       ├── config/
│   │       │   └── env.ts                # Zod-validated env parsing (single source of truth)
│   │       ├── db/
│   │       │   ├── index.ts              # Drizzle client + pg Pool
│   │       │   ├── schema/
│   │       │   │   ├── index.ts          # Re-exports all tables
│   │       │   │   ├── users.ts
│   │       │   │   ├── api-keys.ts
│   │       │   │   ├── vin-stubs.ts
│   │       │   │   ├── make-synonyms.ts
│   │       │   │   ├── api-usage-daily.ts
│   │       │   │   ├── webhook-events.ts
│   │       │   │   ├── email-log.ts
│   │       │   │   ├── admin-users.ts
│   │       │   │   └── admin-audit-log.ts
│   │       │   └── migrations/
│   │       │       └── 0001_initial.sql  # Full initial schema migration
│   │       ├── redis/
│   │       │   └── index.ts              # ioredis client + typed helpers
│   │       ├── middleware/
│   │       │   ├── auth.ts               # Bearer token validation, attaches ctx.user
│   │       │   ├── rate-limit.ts         # Redis sliding window + daily quota
│   │       │   └── request-id.ts         # Attaches req_<nanoid> to every request
│   │       ├── routes/
│   │       │   ├── v1/
│   │       │   │   ├── stub.ts           # GET /v1/stub — core VIN lookup
│   │       │   │   ├── account.ts        # GET /v1/account, key rotation, billing portal
│   │       │   │   ├── makes.ts          # GET /v1/makes
│   │       │   │   ├── models.ts         # GET /v1/models?make=
│   │       │   │   └── health.ts         # GET /v1/health
│   │       │   ├── auth/
│   │       │   │   └── index.ts          # register, verify-email, login, refresh, logout, password reset
│   │       │   ├── webhooks/
│   │       │   │   └── stripe.ts         # POST /webhooks/stripe
│   │       │   └── admin/
│   │       │       └── index.ts          # All /admin/* routes (users, metrics, audit)
│   │       ├── services/
│   │       │   ├── vin.service.ts        # normalize(), lookupStub(), formatResponse()
│   │       │   ├── auth.service.ts       # register, verifyEmail, login, keyGen, keyRotate
│   │       │   ├── stripe.service.ts     # createCheckout, createPortal, syncSubscription
│   │       │   ├── email.service.ts      # Resend wrapper, template dispatch
│   │       │   └── rate-limit.service.ts # Redis counter helpers, plan limit resolver
│   │       └── jobs/
│   │           ├── suspension.job.ts     # Cron: suspend past-due accounts at T+72h
│   │           ├── reminders.job.ts      # Cron: T+24h and T+48h payment reminder emails
│   │           └── usage-sync.job.ts     # Cron: sync Redis day counters → Postgres
│   │
│   ├── worker/                           # Background job runner (separate DO service)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                  # node-cron scheduler — loads all jobs
│   │
│   └── web/                              # Next.js 15 (marketing + dashboard)
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.ts
│       └── src/
│           └── app/
│               ├── (marketing)/          # Public pages: /, /pricing, /docs, /legal
│               └── (dashboard)/          # Auth-gated: /dashboard, /settings, /upgrade
│
├── packages/
│   ├── shared/                           # Shared TypeScript types + constants
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts                  # Plan, AccountStatus, ApiResponse types
│   │       └── constants.ts              # PLAN_LIMITS, PLAN_PRICES
│   │
│   └── email-templates/                  # React Email templates
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── templates/
│               ├── verify-email.tsx
│               ├── welcome.tsx
│               ├── payment-failed.tsx
│               ├── payment-failed-reminder.tsx
│               ├── payment-failed-final.tsx
│               ├── account-suspended.tsx
│               ├── account-reactivated.tsx
│               ├── subscription-changed.tsx
│               └── password-reset.tsx
│
└── scripts/
    └── ingest/                           # CSV ingestion scripts (run manually)
        ├── validate.ts                   # Validate CSV structure and field values
        ├── clean.ts                      # Normalize, deduplicate, write to staging
        ├── mark-base.ts                  # Flag is_base_model per year/make/model group
        └── promote.ts                    # Move staging → production vin_stubs
```
