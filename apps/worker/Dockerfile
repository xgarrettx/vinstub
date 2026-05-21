# ============================================================================
# VINSTUB WORKER — Multi-stage Dockerfile for Railway
# ============================================================================
# Build context: repo root
# Set Dockerfile path to: apps/worker/Dockerfile
#
# The worker shares job logic with the API package (imports from apps/api/src/jobs).
# It runs cron jobs — no HTTP port exposed.
# ============================================================================

FROM node:22-alpine AS base
RUN npm install -g pnpm@9.0.0

# ── Install all workspace deps ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* tsconfig.base.json ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/email-templates/package.json ./packages/email-templates/
RUN pnpm install --no-frozen-lockfile

# ── Build shared + api (jobs) + worker ─────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY packages/email-templates/ ./packages/email-templates/
COPY apps/api/ ./apps/api/
COPY apps/worker/ ./apps/worker/
COPY turbo.json ./
# Worker imports from api's jobs — build both
RUN pnpm --filter @vinstub/shared build
RUN pnpm --filter @vinstub/api build
RUN pnpm --filter worker build

# ── Minimal runtime image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pnpm@9.0.0
WORKDIR /app

ENV NODE_ENV=production

# Re-install prod-only deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/email-templates/package.json ./packages/email-templates/
RUN pnpm install --no-frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/email-templates/dist ./packages/email-templates/dist

# No port — worker is a cron process, not a web server
CMD ["node", "apps/worker/dist/index.js"]
