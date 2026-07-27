FROM node:24-alpine AS base
# Build tools required for better-sqlite3 native addon
RUN apk update && apk upgrade --no-cache && apk add --no-cache python3 make g++ && corepack enable
WORKDIR /app
ENV CI=true

# Build stage
FROM base AS builder

# Copy manifests first — these change rarely, maximising layer cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/platform/package.json apps/platform/
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/
COPY games/scout/package.json games/scout/
COPY games/estimate/package.json games/estimate/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

# Production stage
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/platform/package.json apps/platform/
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/
COPY games/scout/package.json games/scout/
COPY games/estimate/package.json games/estimate/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile

COPY --from=builder /app/apps/platform/dist ./apps/platform/dist

ENV PORT=3002
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/platform/dist/server/apps/platform/server/index.js"]
