# Imposter

A real-time multiplayer social deduction party game built with Vue 3 + Socket.IO + TypeScript.

Players take turns giving short clues about a secret word in a shared random order. One or more
players are **Infiltrators** who do not know the word and must bluff their way through. After all
clues are in, players discuss, vote for suspected Infiltrators, and caught Infiltrators get one
last chance to guess the secret word and steal the round.

## Quick Start

**Production mode:**

```bash
pnpm install
pnpm run build
pnpm start
```

Open `http://localhost:3001`.

**Development mode** (with hot reload):

```bash
pnpm install
pnpm run dev
```

Backend server on port `3001`, Vite dev server on port `5173`.
Open `http://localhost:5173`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Server + Vite client together |
| `pnpm build` | Production build (server + client) |
| `pnpm build:standalone` | Full standalone build (web + server) |
| `pnpm build:lib` | Library bundle for Game Hub embedding |
| `pnpm typecheck` | `tsc` + `vue-tsc` |
| `pnpm lint` | ESLint check (0 warnings required) |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier rewrite all files in place |
| `pnpm format:check` | Prettier dry-run, exit 1 on diffs |
| `pnpm test` | Jest unit tests |
| `pnpm test:e2e` | Playwright E2E (auto-starts server + client) |

## Docker

```bash
docker build -t imposter .
docker run --rm -p 3001:3001 imposter
```

Override port with `-e PORT=<port>`.

## Project Docs

- Architecture: `docs/architecture.md`
- Socket.IO API: `docs/api.md`
- Game Hub integration: `docs/game-hub-integration.md`
