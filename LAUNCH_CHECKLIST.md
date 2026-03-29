# VINSTUB Launch Checklist

Work through this list top-to-bottom before flipping DNS. Each item is a hard dependency for a safe, revenue-ready launch.

---

## Infrastructure

- [ ] DigitalOcean App Platform service created and connected to GitHub main branch
- [ ] Managed Postgres 16 cluster provisioned (minimum 1 GB RAM for MVP)
- [ ] Managed Redis 7 cluster provisioned (minimum 1 GB RAM)
- [ ] DATABASE_URL set in App Platform environment (connection pooling via PgBouncer recommended)
- [ ] REDIS_URL set in App Platform environment (TLS URL, not plain redis://)
- [ ] Custom domain configured and SSL certificate issued (App Platform handles this automatically)
- [ ] Health check URL configured: `GET /v1/health` → expected 200

## Environment Variables

- [ ] All variables from `.env.example` are set in App Platform — no empty values
- [ ] JWT_SECRET is at least 64 random characters (not shared with REFRESH_SECRET)
- [ ] REFRESH_SECRET is at least 64 random characters (not shared with JWT_SECRET)
- [ ] STRIPE_SECRET_KEY starts with `sk_live_` (not `sk_test_`)
- [ ] STRIPE_WEBHOOK_SECRET is the live endpoint secret from Stripe Dashboard
- [ ] STRIPE_PRICE_BASIC / PREMIUM / ENTERPRISE point to live mode price IDs
- [ ] RESEND_API_KEY is active and the sending domain is verified in Resend
- [ ] SENTRY_DSN is set and the Sentry project is configured
- [ ] APP_BASE_URL is the production URL (e.g. `https://vinstub.com`)
- [ ] ADMIN_API_KEY is a strong random secret (32+ chars)
- [ ] ADMIN_TOTP_SECRET is set and you have scanned it into your authenticator app

## Database

- [ ] `pnpm --filter @vinstub/api db:migrate` run against the production database
- [ ] All indexes confirmed present: `\d vin_stubs` in psql shows idx_vin_lookup, idx_vin_base
- [ ] make_synonyms table seeded (should be populated by the migration seed section)
- [ ] `SELECT COUNT(*) FROM vin_stubs WHERE is_active = TRUE;` returns the expected row count after import
- [ ] At least one full data import completed: `pnpm --filter @vinstub/api ingest --file ...`
- [ ] Dry run passes clean before first live import

## Stripe

- [ ] Stripe account is in live mode (not test mode)
- [ ] Three products created: Basic, Premium, Enterprise (monthly recurring)
- [ ] Price IDs copied into environment variables
- [ ] Webhook endpoint registered: `https://api.vinstub.com/webhooks/stripe`
- [ ] Webhook events enabled: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Webhook signing secret copied into STRIPE_WEBHOOK_SECRET
- [ ] Test a full checkout flow in Stripe test mode before switching to live
- [ ] Customer Portal enabled in Stripe Dashboard (Billing → Customer Portal settings)
- [ ] Customer Portal return URL set to your dashboard URL

## Email (Resend)

- [ ] Sending domain verified (DNS records confirmed)
- [ ] From address matches verified domain (e.g. `noreply@vinstub.com`)
- [ ] All email templates tested: verification, welcome, API key issued, payment failed, reminders (24h, 48h), suspended, reactivated, subscription cancelled, password reset
- [ ] Deliverability test: send to a Gmail address, check spam folder

## Security

- [ ] CORS allowed origins list in `app.ts` updated to production domain only
- [ ] `/admin/*` routes are NOT in the public API docs (confirm `tags: ['Admin']` are excluded from Swagger public page)
- [ ] Rate limit constants reviewed — Free tier limits appropriate to prevent abuse
- [ ] Stripe webhook signature verification confirmed working (test with CLI: `stripe trigger invoice.payment_failed`)
- [ ] HTTP → HTTPS redirect enforced (App Platform handles this, verify it's enabled)
- [ ] No secrets committed to git (`git log --all -p | grep sk_live` should return nothing)

## Monitoring

- [ ] Sentry project receiving events (trigger a test error and confirm it appears)
- [ ] Sentry alert rules configured: error spike, P95 latency > 2s
- [ ] Uptime monitoring configured for `/v1/health` (Better Uptime, Checkly, or similar)
- [ ] Alert channel set up (Slack, email, or PagerDuty) for downtime and Sentry alerts
- [ ] Log retention configured in App Platform (30 days minimum)

## Functional Smoke Tests (Run Against Production)

- [ ] `POST /auth/register` — creates account, sends verification email
- [ ] `GET /auth/verify-email?token=` — verifies email, returns API key
- [ ] `POST /auth/login` — returns access token and sets cookie
- [ ] `POST /auth/refresh` — rotates tokens
- [ ] `GET /v1/health` — returns `{"status":"ok"}`
- [ ] `GET /v1/stub?year=2022&make=Toyota&model=Camry` — returns a VIN stub
- [ ] `GET /v1/stub?year=2022&make=chevy&model=Silverado` — synonym resolution works
- [ ] `GET /v1/makes` — returns array of make names
- [ ] `GET /v1/models?make=Toyota` — returns array of model names
- [ ] `GET /v1/account` — returns account info with masked API key
- [ ] `GET /v1/account/billing` — returns Stripe Customer Portal URL
- [ ] Rate limiting: hit `/v1/stub` 6 times in 1 minute on Free plan — 6th request gets 429
- [ ] Stripe checkout: complete a test upgrade flow end-to-end (plan updates correctly)
- [ ] Stripe webhook: trigger `invoice.payment_failed`, confirm billing_status changes to `payment_failed`
- [ ] Admin: `GET /admin/stats` with correct X-Admin-Key + X-Admin-TOTP headers — returns user counts

## Pre-Launch Final Checks

- [ ] `.env.example` is up to date with all current variable names
- [ ] README is accurate (commands, endpoint list, CSV format)
- [ ] All TODO/FIXME comments in source code resolved or triaged
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` succeeds cleanly
- [ ] Changelog or release notes drafted for v0.1.0
- [ ] Billing smoke test: confirm a $0 free user cannot exceed 50 req/day hard limit
- [ ] Confirm suspended account returns 403 on API calls immediately (Redis cache invalidation working)

---

*Mark all items complete before routing production traffic.*
