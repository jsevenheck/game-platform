# Blackout

Blackout is a real-time multiplayer party game where the host reveals a category/task prompt
(optionally with a required letter), players answer out loud, and the host marks the correct player.

Blackout now runs only through the platform party flow. Players enter via the platform and the game
creates or reclaims its room through `autoJoinRoom`.

## Features

- Real-time multiplayer game flow with Socket.IO
- Host-driven reveal flow and manual winner selection
- Round-based scoring with winner-based host handover
- SQLite-backed categories + tasks
- Optional pre-reveal prompt reroll (new task/category and letter if required)
- Host-configurable language (`de`/`en`) and excluded letters
- Session resume and reconnection support
- CSV-driven DB defaults bootstrap on server startup

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Database Import (CSV)

To import categories, tasks, or default excluded letters from CSV:

```bash
node games/blackout/scripts/import-db-csv.mjs --table <categories|tasks|default_excluded_letters> --file <path-to-csv>
```

Full format reference: `docs/database-import.md`

## Project Structure

```text
games/blackout/
├── core/src/         # Shared types, events, constants
├── server/src/       # Models, managers, Socket.IO handlers, SQLite setup
├── ui-vue/src/       # Vue app, components, store, composables
├── docs/             # Architecture and API docs
├── __tests__/        # Vitest unit tests
├── e2e/              # Playwright E2E tests (via platform)
└── scripts/          # DB import utilities
```

## Tech Stack

- Runtime: Node.js
- Language: TypeScript (strict)
- Backend: Express 5, Socket.IO 4, better-sqlite3
- Frontend: Vue 3, Pinia
- Build: Vite, tsc
- Testing: Vitest, Playwright
- Tooling: ESLint 9, Prettier

## Docs

- `docs/architecture.md`
- `docs/api.md`
- `docs/database-import.md`
