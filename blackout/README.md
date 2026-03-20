# Blackout

Blackout is a real-time multiplayer party game where the host reveals a category/task prompt
(optionally with a required letter), players answer out loud, and the host marks the correct player.

## Features

- Real-time multiplayer game flow with Socket.IO
- Host-driven reveal flow and manual winner selection
- Round-based scoring with winner-based host handover
- SQLite-backed categories + tasks
- Optional pre-reveal prompt reroll (new task/category and letter if required)
- Host-configurable language (`de`/`en`) and excluded letters
- Session resume and reconnection support
- CSV-driven DB defaults bootstrap on server startup
- Dual deployment model:
  - standalone app (Express + Vue)
  - Game Hub integration (library export + transform script)

## Prerequisites

- Node.js 22+
- pnpm 10+

## Installation

```bash
pnpm install:all
```

`install:all` installs root dependencies plus `standalone-server` and `standalone-web` package dependencies.

## Development

```bash
pnpm dev
```

This starts:

- standalone server on `http://localhost:3001`
- Vite dev client on `http://localhost:5173`

## Build

```bash
pnpm build
pnpm build:standalone
pnpm build:lib
```

- `pnpm build` builds `ui-vue` client assets + standalone server output
- `pnpm build:standalone` builds `standalone-web` + standalone server output
- `pnpm build:lib` builds the Game Hub-facing Vue library bundle

## Testing

```bash
pnpm test
pnpm test:e2e
```

Recommended quality gate before merging:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

## Deployment

### Standalone

- Build: `pnpm build`
- Start: `pnpm start:standalone`
- Health check: `GET /health`
- Default SQLite path: `server/src/db/blackout.sqlite` (override via `DB_PATH`)
- If the DB is empty, defaults are loaded from `server/src/db/data/*.csv` on startup

### Docker

```bash
docker build -t blackout .
docker run --rm -p 3001:3001 blackout
```

### Game Hub integration

- Build library: `pnpm build:lib`
- Transform project for hub layout:

```bash
node scripts/transform-for-gamehub.mjs
```

See `docs/game-hub-integration.md`.

## Database Import (CSV)

To import categories, tasks, or default excluded letters from CSV:

```bash
pnpm db:import:csv -- --table <categories|tasks|default_excluded_letters> --file <path-to-csv>
```

Full format reference and examples:

- `docs/database-import.md`

## Project Structure

```text
blackout/
+-- core/src/                # Shared types, events, constants
+-- server/src/              # Models, managers, Socket.IO handlers, SQLite setup
+-- ui-vue/src/              # Vue app, components, store, composables
+-- standalone-server/src/   # Express + Socket.IO standalone wrapper
+-- standalone-web/src/      # Standalone Vue entry
+-- docs/                    # Architecture/API/integration docs
+-- __tests__/               # Jest unit tests
+-- e2e/                     # Playwright E2E tests
+-- scripts/                 # Utility scripts (Game Hub transform)
```

## Tech Stack

- Runtime: Node.js
- Language: TypeScript (strict)
- Backend: Express 5, Socket.IO 4, better-sqlite3
- Frontend: Vue 3, Pinia
- Build: Vite, tsc
- Testing: Jest, Playwright
- Tooling: ESLint 9, Prettier
- Containerization: Docker

## Docs

- `docs/architecture.md`
- `docs/api.md`
- `docs/game-hub-integration.md`
- `docs/database-import.md`
- `AGENTS.md`
