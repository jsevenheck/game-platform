# Secret Signals

Secret Signals is a real-time multiplayer word-deduction party game. Players split into teams, each team assigns one Director and one or more Agents, and the active Director gives a one-word signal plus a number for their Agents to interpret.

Current game rules implemented in this repo:

- 5x5 board with unique words
- 800 curated German board words in `server/src/data/words.ts`
- 2 to 8 teams
- 4 to 24 players
- one assassin card and a neutral pool on every board
- starting team receives one extra target card
- the first game starts with a random team, then the starting team rotates between games
- assassin behavior is configurable:
  - `instant-loss`: the team that reveals the assassin loses immediately and all surviving opponents win
  - `elimination`: the team that reveals the assassin is eliminated and play continues for the remaining teams

## Quick Start

Development:

```bash
pnpm install
pnpm dev
```

The Socket.IO server runs on `http://localhost:3001` and the Vite client runs on `http://localhost:5173`.

Production:

```bash
pnpm install
pnpm build
pnpm start
```

Open `http://localhost:3001`.

## Gameplay Notes

- Team setup is validated before the match starts.
- Every active team must have exactly one Director and at least one Agent.
- Minimum players scales with team count: `max(4, teamCount * 2)`.
- Directors can see hidden card ownership during play; Agents only see revealed ownership.
- Active agents can mark multiple candidate cards for the whole team before confirming a reveal.
- The in-game layout shows each team's Director and Agents around the board.
- In multi-team games, eliminated teams are skipped in turn rotation.
- The host can force-skip the active turn, including the Director thinking step.
- Standalone sessions are stored locally, so a page reload reconnects you to the same player slot.
- A disconnected player can also rejoin an active room by joining again with the same name.

## Scripts

| Script                  | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `pnpm dev`              | Run the standalone server and Vue client     |
| `pnpm dev:standalone`   | Run standalone server and standalone web app |
| `pnpm build`            | Build the production client and server       |
| `pnpm build:standalone` | Build standalone web and standalone server   |
| `pnpm build:lib`        | Build the embeddable Vue library bundle      |
| `pnpm typecheck`        | Run TypeScript and Vue type checks           |
| `pnpm lint`             | Run ESLint with zero warnings allowed        |
| `pnpm format:check`     | Verify Prettier formatting                   |
| `pnpm test`             | Run Jest unit tests                          |
| `pnpm test:e2e`         | Run Playwright browser tests                 |

## Docker

```bash
docker build -t secret-signals .
docker run --rm -p 3001:3001 secret-signals
```

Override the port with `-e PORT=<port>`.

## Project Layout

- `core/src`: shared game types, event contracts, constants
- `server/src`: authoritative game state, managers, Socket.IO handlers
- `ui-vue/src`: Vue 3 client, Pinia store, gameplay components
- `standalone-server/src`: Express and Socket.IO wrapper for standalone runtime
- `standalone-web`: standalone web entrypoint

## Documentation

- `docs/architecture.md`: runtime and code structure
- `docs/api.md`: Socket.IO event contracts
- `docs/game-hub-integration.md`: Game Hub packaging and sync workflow
