# Game Platform

A real-time multiplayer party-game platform built with Vue 3, Socket.IO, and TypeScript.
A party host creates a room, invites friends, picks a game, and everyone plays together
in their browser.

## Repository layout

```
apps/platform/      <- Express + Socket.IO server, Vue 3 client (the only production app)
games/<game>/       <- one folder per game (Blackout, Imposter, Secret Signals,
                       Flip 7, Scout, Estimate, Kritzelagent)
docs/               <- platform-wide documentation
```

The platform owns the full lifecycle: create → join → launch game → replay / return to
lobby. Games are internal modules and run only through the platform party flow.

## Quick start

```bash
pnpm install        # install all dependencies
pnpm dev            # start platform (server + client)
```

Then open <http://localhost:5173>.

## Available games

| Game           | Players | Round count  | Description                                       |
| -------------- | ------- | ------------ | ------------------------------------------------- |
| Blackout       | 4–10    | 1            | Cooperative dice-grid memory reveal               |
| Imposter       | 3–10    | until reveal | Social deduction: secret word + clues + vote      |
| Secret Signals | 4–8     | 3–6          | Cooperative code-breaking with asymmetric roles   |
| Flip 7         | 2–8     | until bust   | Press-your-luck card-collection                   |
| Scout          | 2–5     | = players    | Trick-taking with scout / flip actions            |
| Estimate       | 2–12    | 5 (default)  | Number-estimation; closest guess wins             |
| Kritzelagent   | 5–12    | 5 (default)  | Shared drawing, hidden topic, and agent deduction |

See `docs/games.md` for the full per-game reference.

## Useful commands

```bash
pnpm dev              # platform server + client
pnpm build            # build client + server for production
pnpm start            # run production server from dist/
pnpm test             # run all unit tests (vitest, all 7 games)
pnpm test:<game>      # run a single game's unit tests (test:estimate, test:scout, ...)
pnpm test:e2e         # playwright (starts server automatically)
pnpm lint             # eslint across all source
pnpm format           # prettier --write across all source
pnpm format:check     # prettier --check
pnpm typecheck        # vue-tsc + tsc via apps/platform
```

## Documentation

- `docs/adding-a-new-game.md` — playbook for adding a new drop-in game
- `docs/games.md` — full game catalogue with per-game links
- `docs/deployment.md` — Docker, environment, hosting
- `docs/observability-metrics.md` — Prometheus metrics emitted by the platform
- `docs/known-issues.md` — known quirks and caveats
- `games/kritzelagent/README.md` — Kritzelagent rules and development
