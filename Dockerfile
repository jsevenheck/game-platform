FROM node:24-alpine AS base
RUN apk update && apk upgrade --no-cache && corepack enable
WORKDIR /app
ENV CI=true

# Build stage — the native-addon toolchain (better-sqlite3) lives ONLY here.
# Deriving the runtime stage from `base` instead would ship a C++ compiler and
# Python into production, widening the attack surface and the image for no
# runtime benefit.
FROM base AS builder
RUN apk add --no-cache python3 make g++

# Copy manifests first — these change rarely, maximising layer cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/platform/package.json apps/platform/
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/
COPY games/scout/package.json games/scout/
COPY games/estimate/package.json games/estimate/
COPY games/kritzelagent/package.json games/kritzelagent/
COPY games/herd-mentality/package.json games/herd-mentality/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

# Production stage — clean base, no build toolchain.
FROM base AS runtime
ENV NODE_ENV=production
# better-sqlite3 needs its toolchain only to build; the prebuilt/compiled
# addon is installed below from the same pnpm store the builder populated.
RUN apk add --no-cache --virtual .build-deps python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/platform/package.json apps/platform/
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/
COPY games/scout/package.json games/scout/
COPY games/estimate/package.json games/estimate/
COPY games/kritzelagent/package.json games/kritzelagent/
COPY games/herd-mentality/package.json games/herd-mentality/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --prod --frozen-lockfile && \
    apk del .build-deps

COPY --from=builder /app/apps/platform/dist ./apps/platform/dist

# Drop root. Any RCE-class vulnerability would otherwise start as root inside
# the container, which materially eases container escape. `node` is provided
# by the official image.
RUN chown -R node:node /app
USER node

ENV PORT=3002
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "apps/platform/dist/server/apps/platform/server/index.js"]
