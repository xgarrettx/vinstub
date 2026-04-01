FROM node:22-alpine AS base
RUN npm install -g pnpm@9.0.0

# ── Install all workspace deps ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ── Build shared + web ───────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/
# Build shared first so web can import from @vinstub/shared
RUN pnpm --filter @vinstub/shared build
# next build with output: 'standalone' + outputFileTracingRoot creates:
#   apps/web/.next/standalone/apps/web/server.js
RUN pnpm --filter @vinstub/web build

# ── Minimal runtime image ────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone bundle (contains server.js + traced node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets to the path server.js expects (relative to bundle root)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public folder (images, fonts, etc.) — required separately in standalone mode
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

# outputFileTracingRoot=repo-root means server.js is at apps/web/server.js
# relative to the bundle root (which is now /app/)
CMD ["node", "apps/web/server.js"]
