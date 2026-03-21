# AGENTS.md - Imposter

Purpose: concise instructions for AI coding agents working in this repository.

## Project Overview

**Imposter** is a real-time multiplayer social deduction word game built with Vue 3,
Socket.IO, and TypeScript.

Players receive a secret word, except the Infiltrators, who must bluff. The group identifies
Infiltrators through sequential clues, discussion, and voting. Features include:

- dynamic infiltrator count (`0..n-1`)
- paranoia mode (`0` infiltrators)
- host-owned lobby settings
- owner/host transfer behavior
- standalone and embedded Game Hub support
- file-backed shared word library

Architecture layers:

- `core/src`
  shared contracts: types, events, constants
- `server/src`
  Socket.IO backend: models, managers, handlers, utilities
- `ui-vue/src`
  Vue 3 client: store, composables, phase components
- `standalone-server/src`
  standalone Express + Socket.IO runtime
- `standalone-web/src`
  standalone Vue entry

## Key Patterns (Must Follow)

1. **Manager pattern**
   - Keep Socket.IO handlers thin.
   - Put gameplay/state logic in `server/src/managers/*`.
   - Handlers should validate, delegate, then broadcast.

2. **Per-player sanitization**
   - Always emit room state through `broadcastManager`.
   - Never emit raw internal `Room` objects directly.
   - Never leak `resumeToken`, `socketId`, or hidden game-secret state.

3. **Authoritative server state**
   - The server owns room state, timers, transitions, and scoring.
   - UI components should render from `RoomView`, not reconstruct hidden logic locally.

4. **Phase-based flow**
   - Valid phases live in `core/src/types.ts`.
   - Preserve the actual flow:
     - `lobby`
     - `description`
     - `discussion`
     - `voting`
     - `reveal`
     - `ended`

## Current Gameplay Rules To Preserve

- Clues are entered **one at a time** in shared `descriptionOrder`.
- `currentDescriberId` determines whose turn it is.
- The host may skip the active clue turn.
- Description order and infiltrator assignment are randomized per round.
- Randomness is real runtime randomness; do not add test-only behavior that changes live selection.
- `E2E_TESTS=1` only shortens timers. It must not disable randomness.
- Discussion duration and target score are configurable in the lobby.
- A match ends when any player reaches `targetScore`.
- During infiltrator final guess, the secret word stays hidden until the guess resolves.

## Owner / Host Semantics

- `ownerId`
  the player who created the room
- `hostId`
  the player currently holding host controls

Behavior:

- owner starts as host
- if host disconnects, host transfers to another connected player
- if the owner reconnects, host control returns to the owner automatically

Do not collapse `owner` and `host` into one concept when changing reconnect or lobby logic.

## Standalone Session Semantics

Standalone uses local storage for:

- `playerId`
- `roomCode`
- `resumeToken`
- `name`

Reconnect behavior:

- `resumePlayer` restores the exact stored session
- `joinRoom` can reclaim a disconnected active-game slot when the same player name rejoins the same room code

Leave behavior:

- `leaveRoom` in `lobby` or `ended` removes the player from the room
- `leaveRoom` during an active game keeps the player as disconnected so they can reclaim their slot

## Lobby Controls

Host-only controls currently include:

- configure infiltrator count
- configure discussion timer
- configure target score
- start game
- kick another player from the lobby

Any player may submit words to the shared library.

## Embedded Game Hub Notes

Embedded mode uses:

- `sessionId`
- `playerId`
- `playerName`
- `joinToken`
- `wsNamespace`
- `apiBaseUrl`

Important:

- embedded mode uses `autoJoinRoom`
- the client must explicitly call `socket.connect()` when needed
- the server maps `sessionId -> roomCode`
- stable hub `playerId` must be preserved on reconnect

## Common Tasks

### Add a new Socket.IO event

1. Add the event contract in `core/src/events.ts`.
2. Add the server handler in `server/src/handlers/socketHandlers.ts`.
3. Put business logic in a manager or reusable helper.
4. Update `ui-vue/src/App.vue` and/or the store/composables.
5. Add tests for handler and manager behavior.
6. Update docs if the public behavior changed.

### Modify gameplay logic

1. Update shared contracts first if the visible shape changes.
2. Update manager logic before UI.
3. Preserve sanitization rules in `broadcastManager`.
4. Re-run unit and E2E tests.
5. Re-check docs when behavior changes.

### Modify lobby / reconnect behavior

1. Check both standalone and embedded flows.
2. Preserve owner/host semantics.
3. Preserve reconnect/reclaim behavior unless the task explicitly changes it.

## Testing Guidelines

Run these from repo root:

- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Type checks: `pnpm typecheck`
- Lint: `pnpm lint`
- Build library when integration/public UI changes: `pnpm build:lib`

For gameplay, event-contract, reconnect, or lobby-control changes, run at least:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`

## Development Workflow

- Install deps: `pnpm install`
- Start dev stack: `pnpm dev`
  - server on `:3001`
  - Vite client on `:5173`
- Build standalone artifacts: `pnpm build`
- Build Game Hub UI library: `pnpm build:lib`

## Working Rules

- Keep TypeScript strictness intact; avoid `any` unless unavoidable.
- Use pnpm for package management.
- Keep docs updated when changing events, phases, lobby behavior, or integration behavior.
- Prefer updating tests to reflect intended behavior instead of adding runtime hacks for tests.
- If you touch randomness logic, verify you are not accidentally changing production selection behavior.
