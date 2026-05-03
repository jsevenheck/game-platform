# Game Platform

A real-time multiplayer party game platform built as a single **pnpm workspace monorepo**. One platform app hosts multiple integrated games: players create a party, invite friends, pick a game, and play together in the browser.

## Games

| Game               | Description                                                                       | Players |
| ------------------ | --------------------------------------------------------------------------------- | ------- |
| **Blackout**       | Category-based trivia with a rotating host who reveals prompts and picks winners  | 3-20    |
| **Imposter**       | Social deduction where one player is the infiltrator; describe, discuss, and vote | 3-16    |
| **Secret Signals** | Team-based word association where directors give clues and agents guess cards     | 4-24    |

## Tech Stack

- **Client:** Vue 3 + Pinia + Vue Router, bundled with Vite
- **Server:** Express + Socket.IO + Pino logging (TypeScript, run via tsx)
- **Testing:** Vitest (unit), Playwright (E2E)
- **Tooling:** pnpm workspaces, ESLint, Prettier

## Project Structure

```text
apps/platform/               <- the only deployable app
  server/
    index.ts                 <- Express + Socket.IO entry point
    logging/                 <- shared Pino helpers for HTTP + Socket.IO logging
    metrics/                 <- Prometheus metrics registry, collectors, HTTP endpoint
    observability/           <- socket handler instrumentation + namespace connection helpers
    party/                   <- party lifecycle (create, join, launch, return)
    registry/                <- game server module registry
  src/
    router/                  <- Vue Router (/, /party/:code, /party/:code/game/:gameId)
    stores/                  <- Pinia party store
    views/                   <- HomeView, PartyView, GameView
    games/                   <- client-side game registry (dynamic imports)

games/{game}/                <- internal source modules (not standalone)
  core/src/                  <- shared types, constants, event definitions
  server/src/                <- Socket.IO game server (namespace /g/{game})
  ui-vue/src/
    App.vue                  <- platform-only game root component
    PlatformAdapter.vue      <- platform wrapper (overlay for replay/return)
  __tests__/                 <- Vitest unit tests
  e2e/                       <- Playwright E2E specs
  docs/                      <- game-specific API and architecture docs
```

## Getting Started

### Prerequisites

- **Node.js** >= 24.0
- **pnpm** >= 10

### Install and Run

```bash
pnpm install          # install all dependencies
pnpm dev              # start platform (server on :3000 + client on :5173)
```

Open `http://localhost:5173` in your browser. Create a party, share the invite code, and launch a game.

## Logging

The platform server uses structured Pino logging.

- **HTTP:** Express requests are logged through `pino-http` and include an `X-Request-Id` response header.
- **Socket.IO:** platform and game namespaces use shared child loggers with room, player, and match context.
- **Output:** development prefers pretty logs when `pino-pretty` is available; production defaults to JSON on `stdout`.

Supported environment variables:

```bash
LOG_LEVEL=debug         # default: debug in dev, warn in test, info in production
LOG_PRETTY=true         # default: true in dev, false in test/production
LOG_SOCKET_EVENTS=false # set true to enable catch-all Socket.IO event debug logs
```

Notes:

- `/health`, `/metrics`, and successful static asset requests are intentionally not logged by default.
- Secrets and sensitive join data such as `resumeToken`, `joinToken`, `token`, `inviteCode`, `authorization`, and `cookie` are redacted from log output.
- Game server modules should reuse the shared helpers in `apps/platform/server/logging/` instead of adding per-game logging stacks.

## Metrics

The platform exposes Prometheus metrics on `/metrics`.

Supported environment variables:

```bash
METRICS_ENABLED=true         # default: true outside production, false in production
METRICS_AUTH_TOKEN=...       # optional bearer token / x-metrics-token protection
```

Notes:

- In production, `/metrics` is disabled by default unless `METRICS_ENABLED=true` is set.
- When `METRICS_AUTH_TOKEN` is set, requests must send either `Authorization: Bearer <token>` or `x-metrics-token: <token>`.
- See [docs/observability-metrics.md](docs/observability-metrics.md) for the metric catalog, alert ideas, and scrape examples.

## Commands

All commands run from the workspace root:

```bash
pnpm dev                  # start dev server (Express + Vite HMR)
pnpm build                # build client + server for production
pnpm start                # run production build

pnpm test                 # run all unit tests (Vitest, all 3 game projects)
pnpm test:blackout        # run Blackout tests only
pnpm test:imposter        # run Imposter tests only
pnpm test:secret-signals  # run Secret Signals tests only
pnpm test:flip7           # run Flip 7 tests only
pnpm test:e2e             # run Playwright E2E tests (starts server automatically)

pnpm lint                 # ESLint across all source (zero warnings)
pnpm lint:fix             # auto-fix lint issues
pnpm format               # Prettier across all source
pnpm format:check         # check formatting without writing
pnpm typecheck            # TypeScript check (vue-tsc + tsc)
```

## Architecture

### Platform Flow

```text
Create Party -> Join Party -> Select Game -> Launch Game -> Play -> Replay / Return to Lobby
```

1. **Party lifecycle** is owned entirely by the platform (`/party` Socket.IO namespace).
2. When the host launches a game, the platform creates a unique `matchKey` and broadcasts it.
3. All clients navigate to `/party/:code/game/:gameId` and auto-join the game's Socket.IO namespace (`/g/{gameId}`).
4. Each game receives the `matchKey` as `sessionId` in its `autoJoinRoom` event and manages its own room state.
5. After a match ends, the host can **replay** (new `matchKey`, same game) or **return to lobby**.

### Game Integration

Games are internal source modules. They have no standalone server or client. The platform imports them directly:

- **Server side:** each game exports `register(io, namespacePath)` and `cleanupMatch(matchKey)`.
- **Client side:** each game's `PlatformAdapter.vue` is loaded dynamically via Vite aliases.
- **Shared code:** the `@shared/*` alias resolves to each game's `core/src/` directory based on the importing file's location (context-sensitive Vite plugin).
- **Logging:** game server modules should use the shared logger helpers from `apps/platform/server/logging/`.

See [docs/adding-a-new-game.md](docs/adding-a-new-game.md) for the full integration guide.

## Documentation

- [docs/adding-a-new-game.md](docs/adding-a-new-game.md) - how to add a new game to the platform
- [docs/observability-metrics.md](docs/observability-metrics.md) - metrics contract, scrape config, and alert/dashboard seeds
- [games/blackout/docs/](games/blackout/docs/) - Blackout API and architecture
- [games/imposter/docs/](games/imposter/docs/) - Imposter API and architecture
- [games/secret-signals/docs/](games/secret-signals/docs/) - Secret Signals API and architecture
