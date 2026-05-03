# CLAUDE.md

Single pnpm workspace monorepo: one platform app + four integrated games.

```text
apps/platform/       <- Express + Socket.IO server, Vue 3 client (the only production app)
games/blackout/      <- internal platform module (no standalone runtime)
games/imposter/      <- internal platform module
games/secret-signals/ <- internal platform module
games/flip7/         <- internal platform module
```

Games are **internal modules** and run only through the platform party flow. They have no own standalone runtime or toolchain. The platform owns the full lifecycle: create → join → launch game → replay / return to lobby.

## Commands (always run from workspace root)

```bash
pnpm install        # install all dependencies
pnpm dev            # start platform (server + client)
pnpm build          # build client + server for production
pnpm start          # run production server from dist/
pnpm test           # run all unit tests (vitest, all 4 games)
pnpm test:blackout  # run unit tests for a single game
pnpm lint           # eslint across all source
pnpm lint:fix       # eslint with auto-fix
pnpm format         # prettier --write across all source
pnpm format:check   # prettier --check
pnpm typecheck      # tsc via apps/platform
pnpm test:e2e       # playwright (starts server automatically)
```

## Tech Stack

- Vue 3 Composition API (`<script setup lang="ts">`)
- Pinia for state management
- Tailwind CSS v4.2 with `@tailwindcss/vite` plugin
- Socket.IO for real-time party and game communication
- Express server in `apps/platform/server/`
- better-sqlite3 (database used by some games)
- Vitest for unit tests, Playwright for E2E

## Styling

Single design-system entry point: `apps/platform/src/styles/main.css`.
Game UI source is scanned via `@source` directives so Tailwind generates classes used in `games/*/ui-vue/`.

### Design tokens (`@theme`)

| Category | Tokens |
| --- | --- |
| Surfaces | `canvas` (#050509), `shell`, `panel` (#111118), `card` (#15151f), `elevated` |
| Text | `foreground`, `muted`, `muted-foreground` |
| Borders | `border`, `border-strong`, `ring` |
| Platform accent | `accent` (orange #f97316) |
| Game accents | `blackout` (violet), `imposter` (crimson), `signals` (cyan), `flip7` (amber) |
| Semantic | `danger`, `success`, `warning` plus `-muted` variants |

### Shared component classes (`@layer components`)

`ui-shell-header`, `ui-panel`, `ui-overlay`, `ui-dialog`, `ui-btn-primary`, `ui-btn-secondary`, `ui-btn-ghost`, `ui-btn-danger`, `ui-input`, `ui-badge`, `ui-stepper-btn`, `ui-section-label`, `ui-game-card`, `ui-game-card-selected`, `ui-game-card-banner`, `ui-game-card-body`, `ui-player-item`, `ui-avatar`, `ui-tab-group`, `ui-tab`, `ui-progress-track`, `ui-progress-fill`.

Avoid Tailwind `!important` arbitrary classes like `bg-flip7!`. Prefer scoped `<style>` blocks in Vue SFCs.

## Architecture

```text
apps/platform/
  server/
    index.ts          <- Express + Socket.IO entry
    httpRoutes.ts     <- health check + static file serving + SPA fallback
    logging/          <- shared Pino helpers (reuse these, never add your own logger stack)
    party/            <- party domain (types, store, handlers)
    registry/         <- game server module registry
    metrics/          <- Prometheus metrics
    observability/      <- namespace/socket observability helpers
  src/
    main.ts           <- Vue app bootstrap (createApp + Pinia + Router)
    App.vue           <- root platform component
    router/           <- Vue Router
    stores/           <- Pinia party store
    views/            <- HomeView, PartyView, GameView
    games/            <- client-side game registry (loadClient per game)
    composables/      <- shared Vue composables (e.g. usePartySocket)

games/{game}/
  core/src/           <- domain types and shared logic
  server/src/         <- Socket.IO game server (registers on /g/{game} namespace)
  ui-vue/src/
    App.vue           <- game root component (no standalone create/join flow)
    PlatformAdapter.vue <- wraps App.vue, injects platform props, replay/return overlay
```

### Vite aliases

| Alias | Resolves to |
| --- | --- |
| `@platform` | `apps/platform/src/` |
| `@shared/*` | `games/{game}/core/src/` (context-sensitive per game) |
| `@blackout-ui` | `games/blackout/ui-vue/src/` |
| `@imposter-ui` | `games/imposter/ui-vue/src/` |
| `@secret-signals-ui` | `games/secret-signals/ui-vue/src/` |
| `@flip7-ui` | `games/flip7/ui-vue/src/` |

`vue`, `pinia`, and `vue-router` are force-deduplicated so game UIs share a single framework instance with the platform.

### Dev proxy

`pnpm dev` starts the client dev server on port 5173 and the API server on port 3000. Vite proxies `/socket.io` and `/api` to `localhost:3000`.

## Integration Contracts

Every game server module exposes:

- `register(io, namespacePath)` — registers Socket.IO handlers
- `cleanupMatch(matchKey)` — tears down a room by matchKey
- `autoJoinRoom` socket event — creates or rejoins a room for a given sessionId/matchKey

### Props passed to PlatformAdapter.vue

```ts
{
  matchKey: string;      // unique match id (used as sessionId for autoJoinRoom)
  playerId: string;
  playerName: string;
  namespace: string;     // Socket.IO namespace, e.g. /g/secret-signals
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;
}
```

### Props passed to game's App.vue

```ts
{
  sessionId: string;     // maps from matchKey
  playerId: string;
  playerName: string;
  wsNamespace: string;  // maps from namespace
  isHost?: boolean;
  // plus optional: apiBaseUrl, joinToken
}
```

### Game client registry

`apps/platform/src/games/index.ts` exports `clientGameRegistry` — an array of `PlatformGameModule` objects that wire each game into the platform UI:

```ts
export interface PlatformGameMeta {
  icon: string;
  gradFrom: string;
  gradTo: string;
  description: string;
}

export interface PlatformGameModule {
  definition: { id: string; name: string; minPlayers: number; maxPlayers: number };
  platformMeta?: PlatformGameMeta;   // visual metadata for the lobby cards
  loadClient: () => Promise<{ default: Component }>;
}
```

Each entry maps a game ID to its `PlatformAdapter.vue` via lazy `import('@{game}-ui/PlatformAdapter.vue')`. When adding a new game, register it here with both `definition` and `platformMeta`.

## Logging Rules

- Reuse helpers from `apps/platform/server/logging/` (`createComponentLogger`, `createSocketLogger`, `attachSocketEventDebugLogging`).
- Keep logs structured and lifecycle-focused: create, join, resume, start, end, cleanup, failures.
- **Never log secrets or hidden game state**: `resumeToken`, `joinToken`, auth headers, private cards, hidden words, raw payload dumps.
- Sensitive data like `inviteCode` is redacted by shared logger config — do not rely on log output for it.
- Environment flags: `LOG_LEVEL`, `LOG_PRETTY`, `LOG_SOCKET_EVENTS`.

## Metrics Rules

- Prometheus metrics live under `apps/platform/server/metrics/`.
- `/metrics` is enabled by default outside production; in production requires `METRICS_ENABLED=true`.
- Protect production scrapes with `METRICS_AUTH_TOKEN` or internal-only network policy.
- **Keep metric labels low-cardinality** — never use `inviteCode`, `partyId`, `matchKey`, `playerId`, `playerName`, socket IDs, or raw payload fields as labels.

## Adding a New Game

See [docs/adding-a-new-game.md](docs/adding-a-new-game.md) for the full guide: folder structure, server module contract, `PlatformAdapter.vue` pattern, all four platform registration points, design system usage, and the integration checklist.

## Skills

Skills are split across two directories depending on which agent uses them:

- **`.claude/skills/`** — skills for Claude (this agent). When a task falls within a skill's domain, read the corresponding `.claude/skills/<name>/SKILL.md` and follow its procedures.
- **`.agents/skills/`** — skills for other coding agents (e.g. `pi`). These are maintained separately and should not be used by Claude unless explicitly instructed.

Available `.claude/skills/`: `frontend-design`, `pinia`, `playwright-best-practices`, `playwright-cli`, `pnpm`, `tailwind-design-system`, `ui-ux-pro-max`, `vite`, `vitest`, `vue-best-practices`, `vue-pinia-best-practices`, `websocket-engineer`.
