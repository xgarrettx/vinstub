# ============================================================================
# VINSTUB API — Multi-stage Dockerfile for Railway
# ============================================================================
# Build context: repo root (Railway builds from root by default)
# Set Dockerfile path to: apps/api/Dockerfile
# ============================================================================

FROM node:22-alpine AS base
RUN npm install -g pnpm@9.0.0

# ── Install all workspace deps ─────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --no-frozen-lockfile

# ── Build shared + api ─────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY turbo.json ./
RUN pnpm --filter @vinstub/shared build
RUN pnpm --filter @vinstub/api build

# ── Minimal runtime image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN npm install -g pnpm@9.0.0
WORKDIR /app

ENV PORT=8080

# Install ALL deps including devDeps (tsx + drizzle-kit needed for db:migrate)
# NODE_ENV must NOT be "production" during install or pnpm skips devDependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN NODE_ENV=development pnpm install --no-frozen-lockfile

ENV NODE_ENV=production

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy drizzle migrations + config (needed at runtime for db:migrate)
COPY --from=builder /app/apps/api/src/db/migrations ./apps/api/src/db/migrations
COPY --from=builder /app/apps/api/drizzle.config.ts ./apps/api/

EXPOSE 8080

# Railway injects env vars at runtime — no .env file needed
CMD ["node", "apps/api/dist/server.js"]
