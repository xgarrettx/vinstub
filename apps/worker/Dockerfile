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
RUN pnpm install --no-frozen-lockfile

# ── Build shared + api (the worker imports api source directly) ────────────
FROM deps AS builder
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY apps/worker/ ./apps/worker/
COPY turbo.json ./
RUN pnpm --filter @vinstub/shared build

# ── Runtime image — runs worker source via tsx ─────────────────────────────
# The worker imports from ../../api/src/ (TypeScript source, not dist),
# so we run it with tsx instead of compiling separately.
FROM node:22-alpine AS runner
RUN npm install -g pnpm@9.0.0
WORKDIR /app

# Install ALL deps (tsx is a devDependency)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* tsconfig.base.json ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN NODE_ENV=development pnpm install --no-frozen-lockfile

ENV NODE_ENV=production

# Copy source (worker runs from TypeScript via tsx)
COPY --from=builder /app/packages/shared/ ./packages/shared/
COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/apps/worker/ ./apps/worker/

# No port — worker is a cron process, not a web server
CMD ["npx", "tsx", "apps/worker/src/index.ts"]
