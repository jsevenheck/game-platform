# AGENTS.md - Secret Signals

Purpose: concise instructions for AI coding agents working in this repository.

## Project Overview

**Secret Signals** is a real-time multiplayer word-deduction party game built with Vue 3, Socket.IO, and TypeScript.

Current gameplay scope:

- 5x5 word grid
- 2 to 8 teams
- 4 to 24 players
- one Director and at least one Agent per active team
- configurable assassin behavior: `instant-loss` or `elimination`

Architecture layers:

- `core/src`: shared contracts (types, events, constants), zero runtime dependencies
- `server/src`: Socket.IO backend (models, managers, event handlers)
- `ui-vue/src`: Vue 3 client (Pinia store, composables, gameplay components)
- `standalone-server/src`: thin standalone Express and Socket.IO wrapper
- `standalone-web/src`: thin standalone Vue app entry

## Key Patterns

1. **Manager pattern**
   - Keep Socket.IO handlers thin.
   - Put gameplay logic into `server/src/managers/*`.
   - Handlers validate input, call managers, then broadcast.

2. **Per-player sanitization**
   - Always broadcast room state via `broadcastManager`.
   - Never emit raw internal room state directly.
   - Strip `resumeToken`, `socketId`, and hidden game information before sending to clients.

3. **Phase-based state machine**
   - Valid phases are defined in `core/src/types.ts`.
   - Do not mutate room or turn phase ad hoc in handlers; use manager helpers.
   - Keep transition side effects explicit and testable.

4. **Shared contracts first**
   - If a gameplay change affects payloads, update `core/src/*` first.
   - Keep `winnerTeam` and `winningTeams` consistent when ending a game.
   - Keep `assassinPenaltyMode` documented in both API and UI behavior.

## Common Tasks

### Add a new Socket.IO event

1. Add the event contract in `core/src/events.ts`.
2. Add the server handler in `server/src/handlers/socketHandlers.ts`.
3. Implement or reuse logic in `server/src/managers/*`.
4. Update client emitter and listener usage in `ui-vue/src/App.vue`, the store, or composables.
5. Add unit tests for manager logic and handler flow.

### Add a new Vue component

1. Create the component in `ui-vue/src/components` or `ui-vue/src/panels`.
2. Keep shared game state in Pinia (`ui-vue/src/stores/game.ts`), not duplicated in component-local state.
3. Wire phase rendering in `ui-vue/src/App.vue`.
4. Keep socket interaction centralized in App, the store, or composables where possible.

### Modify game logic

1. Change shared types and constants first if the contract changes (`core/src/*`).
2. Update relevant managers and phase transitions.
3. Preserve broadcast sanitization guarantees.
4. Update unit tests and E2E tests for behavior changes.
5. Update `README.md` and `docs/*` if events, phases, limits, or integration behavior changed.

## Testing Guidelines

Run these from the repo root:

- `pnpm test`
- `pnpm test:e2e`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`

For gameplay, event-contract, or visibility changes, run unit tests and E2E tests.

## Development Workflow

- Install deps: `pnpm install`
- Start the dev stack: `pnpm dev`
  - server on `:3001`
  - Vite client on `:5173`
- Build standalone production artifacts: `pnpm build`
- Build the Game Hub library bundle: `pnpm build:lib`

## MCP Servers

| Server     | Purpose                                |
| ---------- | -------------------------------------- |
| fetch      | Fetch URLs and docs during development |
| filesystem | File operations                        |
| ripgrep    | Fast codebase search                   |
| pnpm       | Package management                     |
| playwright | Browser automation and E2E             |

## Working Rules

- Keep TypeScript strictness intact; avoid `any` unless unavoidable.
- Avoid leaking internal fields (`resumeToken`, `socketId`) to clients.
- Keep docs updated when adding or changing events, phases, limits, or integration behavior.
- Use `pnpm` for package management.
