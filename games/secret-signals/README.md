# Secret Signals

Secret Signals is a real-time multiplayer word-deduction party game. Players split into teams, each team assigns one Director and one or more Agents, and the active Director gives a one-word signal plus a number for their Agents to interpret.

Current game rules:

- 5x5 board with unique words
- 800 curated German board words in `server/src/data/words.ts`
- 2 to 4 teams
- 4 to 24 players
- one assassin card and a neutral pool on every board
- starting team receives one extra target card
- the first game starts with a random team, then the starting team rotates between games
- assassin behavior is configurable:
  - `instant-loss`: the team that reveals the assassin loses immediately and all surviving opponents win
  - `elimination`: the team that reveals the assassin is eliminated and play continues for the remaining teams

## Gameplay Notes

- Team setup is validated before the match starts.
- Every active team must have exactly one Director and at least one Agent.
- Minimum players scales with team count: `max(4, teamCount * 2)`.
- Directors can see hidden card ownership during play; Agents only see revealed ownership.
- Active agents can mark multiple candidate cards for the whole team before confirming a reveal.
- The in-game layout shows each team's Director and Agents around the board.
- In multi-team games, eliminated teams are skipped in turn rotation.
- The host can force-skip the active turn, including the Director thinking step.
- A disconnected player can reclaim their slot through the platform-driven reconnect flow using the
  stored resume token.

## Development

Run from the workspace root:

```bash
pnpm dev        # start platform (server + client)
pnpm test       # run all unit tests
pnpm test:e2e   # run Playwright e2e tests (starts server automatically)
pnpm typecheck  # TypeScript check
pnpm lint       # ESLint
```

## Project Layout

- `core/src`: shared game types, event contracts, constants
- `server/src`: authoritative game state, managers, Socket.IO handlers
- `ui-vue/src`: Vue 3 client, Pinia store, gameplay components

## Documentation

- `docs/architecture.md`: runtime and code structure
- `docs/api.md`: Socket.IO event contracts
