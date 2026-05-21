# Deploying VINStub to Railway

## Overview

VINStub runs as **3 services** from one monorepo on Railway, plus managed Postgres and Redis.

| Service  | Dockerfile              | Port | Purpose                      |
|----------|-------------------------|------|------------------------------|
| `api`    | `apps/api/Dockerfile`   | 8080 | Fastify REST API             |
| `web`    | `apps/web/Dockerfile`   | 3000 | Next.js frontend             |
| `worker` | `apps/worker/Dockerfile`| none | Background cron jobs         |

Estimated cost at launch: **$5–15/month** (usage-based pricing).

---

## Step-by-Step Setup

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Empty Project**.
3. Name it `vinstub`.

### 2. Add Postgres

1. Click **+ New** → **Database** → **PostgreSQL**.
2. Railway provisions it instantly. Note the `DATABASE_URL` in the Variables tab — it will be shared with your services.

### 3. Add Redis

1. Click **+ New** → **Database** → **Redis**.
2. Note the `REDIS_URL` in Variables.

### 4. Deploy the API Service

1. Click **+ New** → **GitHub Repo** → select your VINStub repo.
2. In **Settings**:
   - **Root Directory**: leave blank (build context is repo root)
   - **Dockerfile Path**: `apps/api/Dockerfile`
   - **Port**: `8080`
3. In **Variables**, add all required env vars (see below).
4. Under **Networking**, generate a public domain (e.g., `api-vinstub.up.railway.app`).

### 5. Deploy the Web Service

1. Click **+ New** → **GitHub Repo** → same repo.
2. In **Settings**:
   - **Dockerfile Path**: `apps/web/Dockerfile`
   - **Port**: `3000`
3. In **Variables**, add:
   - `NEXT_PUBLIC_API_URL` = your API's public URL from step 4
4. Under **Networking**, generate a public domain (or add a custom domain like `vinstub.com`).

### 6. Deploy the Worker Service

1. Click **+ New** → **GitHub Repo** → same repo.
2. In **Settings**:
   - **Dockerfile Path**: `apps/worker/Dockerfile`
   - Leave port empty — worker doesn't serve HTTP.
3. In **Variables**, add the same database/Redis/email vars as the API.

---

## Environment Variables

Set these on the **API** and **Worker** services. Railway auto-injects `DATABASE_URL` and `REDIS_URL` if you link the database plugins to the services.

| Variable                | Where to set   | Example / Notes                          |
|------------------------|----------------|------------------------------------------|
| `DATABASE_URL`          | API, Worker    | Auto-injected when Postgres is linked    |
| `REDIS_URL`             | API, Worker    | Auto-injected when Redis is linked       |
| `NODE_ENV`              | All            | `production`                             |
| `PORT`                  | API=8080, Web=3000 | Railway detects automatically        |
| `APP_BASE_URL`          | API            | `https://vinstub.com` (your web domain)  |
| `APP_URL`               | API            | Same as above (CORS origin)             |
| `JWT_SECRET`            | API, Worker    | `openssl rand -hex 32`                  |
| `REFRESH_SECRET`        | API, Worker    | `openssl rand -hex 32`                  |
| `STRIPE_SECRET_KEY`     | API            | From Stripe dashboard                   |
| `STRIPE_WEBHOOK_SECRET` | API            | From Stripe webhook config              |
| `STRIPE_PRICE_BASIC`    | API            | Stripe price ID for Basic plan          |
| `STRIPE_PRICE_PREMIUM`  | API            | Stripe price ID for Premium plan        |
| `STRIPE_PRICE_ENTERPRISE`| API           | Stripe price ID for Enterprise plan     |
| `RESEND_API_KEY`        | API, Worker    | From Resend dashboard                   |
| `ADMIN_API_KEY`         | API            | `openssl rand -hex 32`                  |
| `ADMIN_TOTP_SECRET`     | API            | Generate via otplib                      |
| `NEXT_PUBLIC_API_URL`   | Web            | Public URL of the API service            |

### Linking Databases to Services

In each service's **Variables** tab, click **+ Reference Variable** and select the Postgres/Redis plugin. This auto-injects `DATABASE_URL` and `REDIS_URL` without manual copy-paste.

---

## Running Database Migrations

After the first deploy, run migrations via Railway's CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link to your project
railway login
railway link

# Run migrations against the API service
railway run --service api -- pnpm db:migrate
```

Or add a **release command** in the API service settings:
```
pnpm db:migrate
```
This runs automatically before each deploy.

---

## Custom Domains

1. In the **web** service → **Settings** → **Networking** → **Custom Domain**.
2. Add `vinstub.com` and `www.vinstub.com`.
3. Railway gives you CNAME records — add them at your DNS provider.
4. For the API, add `api.vinstub.com` the same way.

---

## Cost Breakdown (Estimated)

Railway charges per-resource usage (no per-service minimum):

| Resource            | Estimated Monthly Cost |
|---------------------|----------------------|
| API compute         | $1–3                 |
| Web compute         | $1–3                 |
| Worker compute      | $0.50–1              |
| Postgres (500 MB)   | $1–3                 |
| Redis (25 MB)       | $0.50–1              |
| **Total**           | **$4–11**            |

Railway's Hobby plan is $5/month (includes $5 of usage credit). You only pay overage. At low-to-moderate traffic, you'll stay well under $20/month.

---

## Stripe Webhook Setup

Once the API is deployed, configure Stripe to send webhooks to:

```
https://api.vinstub.com/webhooks/stripe
```

In the Stripe dashboard:
1. Go to **Developers** → **Webhooks** → **Add endpoint**.
2. URL: your API's public URL + `/webhooks/stripe`
3. Events to listen for: `customer.subscription.*`, `invoice.*`, `checkout.session.completed`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Railway.

---

## Monitoring

- **Railway Dashboard**: built-in logs, metrics, and deploy history per service.
- **Sentry** (optional): set `SENTRY_DSN` on API and Worker for error tracking.
- **Health check**: hit `GET /v1/health` on the API to verify it's running.
