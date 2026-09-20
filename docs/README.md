# Game Platform

A real-time multiplayer party-game platform built with Vue 3, Socket.IO, and TypeScript.
A party host creates a room, invites friends, picks a game, and everyone plays together
in their browser.

## Repository layout

```
apps/platform/      <- Express + Socket.IO server, Vue 3 client (the only production app)
games/<game>/       <- one folder per game (Blackout, Imposter, Secret Signals,
                       Flip 7, Scout, Estimate, Kritzelagent, Herd Mentality)
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

| Game           | Players | Round count    | Description                                                   |
| -------------- | ------- | -------------- | ------------------------------------------------------------- |
| Blackout       | 3–20    | configurable   | Category-based trivia with host-selected winners              |
| Imposter       | 3–16    | until target   | Social deduction with secret word, clues, and voting          |
| Secret Signals | 4–24    | until game end | Team word association with Directors and Agents               |
| Flip 7         | 3–18    | until target   | Push-your-luck card game with busts and action cards          |
| Scout          | 2–5     | one per player | Ladder-climbing card game with Scout and Scout & Show actions |
| Estimate       | 2–12    | 5 (default)    | Numeric trivia; the closest guess wins                        |
| Kritzelagent   | 5–12    | 5 (default)    | Shared drawing, hidden topic, and agent deduction             |
| Herd Mentality | 4–20    | 8 (default)    | Secret majority answers, cows, and Pink Cow                   |

See `docs/games.md` for the full per-game reference.

## Useful commands

```bash
pnpm dev              # platform server + client
pnpm build            # build client + server for production
pnpm start            # run production server from dist/
pnpm test             # run all unit tests (vitest, all 8 games)
pnpm test:<game>      # run a single game's unit tests (test:estimate, test:scout, ...)
pnpm test:e2e         # playwright (starts server automatically)
pnpm lint             # eslint across all source
pnpm format           # prettier --write across all source
pnpm format:check     # prettier --check
pnpm typecheck        # platform vue-tsc + server tsc
pnpm typecheck:games  # vue-tsc for every game UI
```

## Documentation

- `docs/adding-a-new-game.md` — playbook for adding a new drop-in game
- `docs/games.md` — full game catalogue with per-game links
- `docs/deployment.md` — Docker, environment, hosting
- `docs/observability-metrics.md` — Prometheus metrics emitted by the platform
- `docs/known-issues.md` — current known quirks and caveats
- `docs/rules-audit.md` — current rule-compatibility status and deliberate variants
- `games/kritzelagent/README.md` — Kritzelagent rules and development
- `games/herd-mentality/README.md` — Herd Mentality rules and development
