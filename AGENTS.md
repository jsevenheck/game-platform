# Agent Instructions - Game Platform Monorepo

## What this is

A single pnpm workspace monorepo. One platform app, three integrated games.

```text
apps/platform/   <- the only production app (Express + Socket.IO server, Vue 3 client)
games/blackout/  <- internal platform module (no standalone runtime)
games/imposter/  <- internal platform module
games/secret-signals/ <- internal platform module
```

## Key facts

- Games are **internal modules** and run only through the platform party flow. They have no own standalone runtime or toolchain.
- The platform owns the full party lifecycle: create -> join -> launch game -> replay / return to lobby.
- `matchKey` is the unique identifier per match, passed as `sessionId` to each game's `autoJoinRoom` handler.
- `@shared/*` in game UI code resolves to `games/{game}/core/src/` via Vite's context-sensitive alias (see `apps/platform/vite.config.ts`) and per-game `ui-vue/tsconfig.json`.
- Shared server logging lives in `apps/platform/server/logging/`; game modules should reuse those helpers instead of adding their own logger stack.

## Skills

Custom skills live in `.agents/skills/`.

| Skill                       | Trigger description                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-design`           | Build distinctive, production-grade frontend UI with strong visual direction and polished implementation                                                                                        |
| `pinia`                     | Pinia official Vue state management library — stores, state/getters/actions, store patterns, plugins, SSR                                                                                       |
| `playwright-best-practices` | Playwright testing best practices for E2E/component/API testing, flaky test fixes, CI, auth, accessibility, multi-user flows, WebSockets, performance, security, and advanced browser scenarios |
| `playwright-cli`            | Browser automation via `playwright-cli` for navigation, interaction, screenshots, and debugging                                                                                                 |
| `pnpm`                      | pnpm-specific commands, workspace config, catalogs, overrides, and patches                                                                                                                      |
| `tailwind-design-system`    | Tailwind CSS v4 design systems, tokens, shared component patterns, and responsive styling                                                                                                       |
| `ui-ux-pro-max`             | UI/UX design intelligence for styles, palettes, typography, accessibility, and frontend direction                                                                                               |
| `vite`                      | Vite build tool configuration, plugin API, SSR, and Vite 8 Rolldown migration                                                                                                                   |
| `vitest`                    | Vitest testing framework — config, test suites, mocking with vi.fn/vi.mock, coverage, parallel runs                                                                                             |
| `vue-best-practices`        | Vue 3 Composition API, reactive components, SSR, TypeScript patterns, and Pinia/Vue Router integration                                                                                          |
| `vue-pinia-best-practices`  | Pinia best practices, common gotchas (no active Pinia, reactivity loss), and state management patterns                                                                                          |
| `websocket-engineer`        | Real-time WebSocket and Socket.IO architecture for bidirectional messaging, room management, presence, and scaling                                                                              |

## Commands (always run from workspace root)

```bash
pnpm install        # install all dependencies
pnpm dev            # start platform (server + client)
pnpm test           # run all unit tests (vitest, all 3 games)
pnpm lint           # eslint across all source
pnpm format         # prettier across all source
pnpm typecheck      # tsc via apps/platform
pnpm test:e2e       # playwright (starts server automatically)
```

## Styling

Tailwind CSS v4.2 with `@tailwindcss/vite` plugin. Single design-system entry point:

- **`apps/platform/src/styles/main.css`** - all tokens, base layer, and shared component classes.
- Game UI source is scanned via `@source` directives so Tailwind generates classes used in `games/*/ui-vue/`.

### Design tokens (defined in `@theme`)

| Category        | Tokens                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| Surfaces        | `canvas`, `shell`, `panel`, `elevated` (4 depth levels)                                   |
| Text            | `foreground`, `muted`, `muted-foreground`                                                 |
| Borders         | `border`, `border-strong`, `ring`                                                         |
| Platform accent | `accent` (orange `#f97316`)                                                               |
| Game accents    | `blackout` (violet `#8b5cf6`), `imposter` (crimson `#e11d48`), `signals` (cyan `#06b6d4`) |
| Semantic        | `danger`, `success`, `warning` plus `-muted` variants                                     |

### Shared component classes (`@layer components`)

`ui-shell-header`, `ui-panel`, `ui-overlay`, `ui-dialog`, `ui-btn-primary`, `ui-btn-secondary`, `ui-btn-ghost`, `ui-btn-danger`, `ui-input`, `ui-badge`, `ui-stepper-btn`, `ui-section-label`, `ui-progress-track`, `ui-progress-fill`.

Game-specific accent overrides use Tailwind's `!` important suffix: `bg-blackout!`, `bg-imposter!`, `bg-signals!`.

## Structure

```text
apps/platform/
  server/
    index.ts          <- Express + Socket.IO entry
    logging/          <- shared Pino helpers for root, HTTP, and Socket.IO logging
    party/            <- party domain (types, store, handlers)
    registry/         <- game server module registry
  src/
    router/           <- Vue Router (/, /party/:code, /party/:code/game/:gameId)
    stores/           <- Pinia party store
    views/            <- HomeView, PartyView, GameView
    games/            <- client-side game registry (loadClient per game)

games/{game}/
  core/src/           <- domain types and shared logic
  server/src/         <- Socket.IO game server (registers on /g/{game} namespace)
  ui-vue/src/
    App.vue           <- platform-only game root component (no standalone create/join flow)
    PlatformAdapter.vue <- wraps App.vue, injects platform props, adds replay / return overlay
```

## Adding a new game

See **[docs/adding-a-new-game.md](docs/adding-a-new-game.md)** for the full step-by-step guide: folder structure, server module contract, `PlatformAdapter.vue` pattern, all four platform registration points, design system usage, and the integration checklist.

## Logging

- Server logging is centralized in `apps/platform/server/logging/`.
- Reuse `createComponentLogger()` for namespace or component loggers and `createSocketLogger()` / `attachSocketEventDebugLogging()` for Socket.IO handlers.
- Keep logs structured and lifecycle-focused: create, join, resume, start, end, cleanup, and failures.
- Never log secrets or hidden game state such as `resumeToken`, `joinToken`, auth headers, private cards, hidden words, or raw payload dumps.
- Sensitive join data like `inviteCode` is redacted by the shared logger config and should not be relied on in log output.
- Environment flags: `LOG_LEVEL`, `LOG_PRETTY`, `LOG_SOCKET_EVENTS`.

## Metrics

- Prometheus metrics live under `apps/platform/server/metrics/` and namespace/socket observability helpers under `apps/platform/server/observability/`.
- `/metrics` is enabled by default outside production and disabled by default in production unless `METRICS_ENABLED=true` is set.
- Protect production scrapes with `METRICS_AUTH_TOKEN` or internal-only network policy.
- Keep metric labels low-cardinality; never add `inviteCode`, `partyId`, `matchKey`, `playerId`, `playerName`, socket IDs, or raw payload fields as labels.

## Integration contracts

Every game exposes:

- `register(io, namespacePath)` - registers Socket.IO handlers
- `cleanupMatch(matchKey)` - tears down a room by matchKey
- `autoJoinRoom` socket event - creates or rejoins a room for a given sessionId/matchKey

### PlatformGameProps

These props are passed to each `PlatformAdapter.vue`:

```ts
{
  matchKey: string;      // Unique match identifier (used as sessionId for autoJoinRoom)
  playerId: string;      // Platform-assigned player ID
  playerName: string;    // Player's display name
  namespace: string;     // Socket.IO namespace (e.g., `/g/secret-signals`)
  isHost?: boolean;      // Whether this player is the party host
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
  actionError?: string;  // Error message from platform actions (replay/lobby)
}
```

### App.vue Props (HubIntegrationProps)

The game's `App.vue` receives props mapped from `PlatformAdapter.vue`. The prop names differ:

```ts
{
  sessionId: string;     // maps to PlatformGameProps.matchKey
  playerId: string;
  playerName: string;
  wsNamespace: string;  // maps to PlatformGameProps.namespace
  isHost?: boolean;
  // plus optional: apiBaseUrl, joinToken
}
```

```

```
