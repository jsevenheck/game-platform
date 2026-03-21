# Game Platform

A real-time multiplayer party game platform built as a single **pnpm workspace monorepo**. One platform app hosts multiple integrated games — players create a party, invite friends, pick a game, and play together via the browser.

## Games

| Game               | Description                                                                      | Players |
| ------------------ | -------------------------------------------------------------------------------- | ------- |
| **Blackout**       | Category-based trivia with a rotating host who reveals prompts and picks winners | 3–20    |
| **Imposter**       | Social deduction — one player is the infiltrator; describe, discuss, and vote    | 3–16    |
| **Secret Signals** | Team-based word association — directors give clues, agents guess cards           | 4–24    |

## Tech Stack

- **Client:** Vue 3 + Pinia + Vue Router, bundled with Vite
- **Server:** Express + Socket.IO (TypeScript, run via tsx)
- **Testing:** Jest (unit), Playwright (E2E)
- **Tooling:** pnpm workspaces, ESLint, Prettier

## Project Structure

```
apps/platform/               ← the only deployable app
  server/
    index.ts                  ← Express + Socket.IO entry point
    party/                    ← party lifecycle (create, join, launch, return)
    registry/                 ← game server module registry
  src/
    router/                   ← Vue Router (/, /party/:code, /party/:code/game/:gameId)
    stores/                   ← Pinia party store
    views/                    ← HomeView, PartyView, GameView
    games/                    ← client-side game registry (dynamic imports)

games/{game}/                 ← internal source modules (not standalone)
  core/src/                   ← shared types, constants, event definitions
  server/src/                 ← Socket.IO game server (namespace /g/{game})
  ui-vue/src/
    App.vue                   ← game root component
    PlatformAdapter.vue       ← platform wrapper (overlay for replay/return)
  __tests__/                  ← Jest unit tests
  e2e/                        ← Playwright E2E specs
  docs/                       ← game-specific API & architecture docs
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 22.22
- **pnpm** ≥ 10

### Install & Run

```bash
pnpm install          # install all dependencies
pnpm dev              # start platform (server on :3000 + client on :5173)
```

Open `http://localhost:5173` in your browser. Create a party, share the invite code, and launch a game.

## Commands

All commands run from the workspace root:

```bash
pnpm dev              # start dev server (Express + Vite HMR)
pnpm build            # build client + server for production
pnpm start            # run production build

pnpm test             # run all unit tests (Jest, all 3 game projects)
pnpm test:blackout    # run Blackout tests only
pnpm test:imposter    # run Imposter tests only
pnpm test:secret-signals  # run Secret Signals tests only
pnpm test:e2e         # run Playwright E2E tests (starts server automatically)

pnpm lint             # ESLint across all source (zero warnings)
pnpm lint:fix         # auto-fix lint issues
pnpm format           # Prettier across all source
pnpm format:check     # check formatting without writing
pnpm typecheck        # TypeScript check (vue-tsc + tsc)
```

## Architecture

### Platform Flow

```
Create Party → Join Party → Select Game → Launch Game → Play → Replay / Return to Lobby
```

1. **Party lifecycle** is owned entirely by the platform (`/party` Socket.IO namespace).
2. When the host launches a game, the platform creates a unique `matchKey` and broadcasts it.
3. All clients navigate to `/party/:code/game/:gameId` and auto-join the game's Socket.IO namespace (`/g/{gameId}`).
4. Each game receives the `matchKey` as `sessionId` in its `autoJoinRoom` event and manages its own room state.
5. After a match ends, the host can **replay** (new matchKey, same game) or **return to lobby**.

### Game Integration

Games are internal source modules — they have no standalone server or client. The platform imports them directly:

- **Server side:** Each game exports `register(io, namespacePath)` and `cleanupMatch(matchKey)`.
- **Client side:** Each game's `PlatformAdapter.vue` is loaded dynamically via Vite aliases.
- **Shared code:** The `@shared/*` alias resolves to each game's `core/src/` directory based on the importing file's location (context-sensitive Vite plugin).

See [docs/adding-a-new-game.md](docs/adding-a-new-game.md) for a step-by-step guide.

## Documentation

- [docs/adding-a-new-game.md](docs/adding-a-new-game.md) — How to add a new game to the platform
- [games/blackout/docs/](games/blackout/docs/) — Blackout API & architecture
- [games/imposter/docs/](games/imposter/docs/) — Imposter API & architecture
- [games/secret-signals/docs/](games/secret-signals/docs/) — Secret Signals API & architecture

## License

Private — not published.
