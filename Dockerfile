# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:24-slim AS builder

# Native build tools required for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm via corepack (version from packageManager field in package.json)
RUN corepack enable

# Copy manifests first — these change rarely, maximising layer cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/platform/package.json apps/platform/
COPY games/blackout/package.json games/blackout/
COPY games/imposter/package.json games/imposter/
COPY games/secret-signals/package.json games/secret-signals/
COPY games/flip7/package.json games/flip7/

RUN pnpm install --frozen-lockfile

# Copy all source and build
COPY . .
RUN pnpm build

# Strip dev dependencies to slim the final image
RUN CI=true pnpm prune --prod

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM gcr.io/distroless/nodejs24-debian12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/platform/dist ./apps/platform/dist

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

# distroless entrypoint is /nodejs/bin/node — CMD is the script argument
CMD ["apps/platform/dist/server/apps/platform/server/index.js"]
