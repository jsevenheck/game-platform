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

## Skills

Custom skills live in `.skills/`.

| Skill                    | Trigger description                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `find-skills`            | Discover and install agent skills when the user asks for capabilities, tooling, or "is there a skill for X?" |
| `frontend-design`        | Build distinctive, production-grade frontend UI with strong visual direction and polished implementation     |
| `playwright-cli`         | Browser automation via `playwright-cli` for navigation, interaction, screenshots, and debugging              |
| `pnpm`                   | pnpm-specific commands, workspace config, catalogs, overrides, and patches                                   |
| `tailwind-design-system` | Tailwind CSS v4 design systems, tokens, shared component patterns, and responsive styling                    |
| `ui-ux-pro-max`          | UI/UX design intelligence for styles, palettes, typography, accessibility, and frontend direction            |
| `vite`                   | Vite build tool configuration, plugin API, SSR, and Vite 8 Rolldown migration                                |
| `vue-best-practices`     | Vue 3 Composition API, reactive components, SSR, TypeScript patterns, and Pinia/Vue Router integration       |
| `pinia`                  | Pinia official Vue state management library — stores, state/getters/actions, store patterns, plugins, SSR          |
| `vitest`                 | Vitest testing framework — config, test suites, mocking with vi.fn/vi.mock, coverage, parallel runs               |
| `vue-pinia-best-practices` | Pinia best practices, common gotchas (no active Pinia, reactivity loss), and state management patterns           |
| `websocket-engineer`     | Real-time WebSocket and Socket.IO architecture for bidirectional messaging, room management, presence, and scaling |

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

Game-specific accent overrides use Tailwind's `!` important modifier: `!bg-blackout`, `!bg-imposter`, `!bg-signals`.

## Structure

```text
apps/platform/
  server/
    index.ts          <- Express + Socket.IO entry
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

## Integration contracts

Every game exposes:

- `register(io, namespacePath)` - registers Socket.IO handlers
- `cleanupMatch(matchKey)` - tears down a room by matchKey
- `autoJoinRoom` socket event - creates or rejoins a room for a given sessionId/matchKey

`PlatformGameProps` passed to each `PlatformAdapter.vue`:

```ts
{
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  isHost?: boolean;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
}
```
