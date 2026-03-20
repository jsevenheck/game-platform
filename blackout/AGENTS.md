# AGENTS.md - Blackout

Purpose: concise instructions for AI coding agents working in this repository.

## Project Overview

Blackout is a real-time multiplayer party game (Scattergories-style): players buzz in with spoken answers and the reader validates who was first with a correct answer.

Architecture layers:

- `core/src`: shared contracts (types, events, constants), zero runtime dependencies
- `server/src`: Socket.IO backend (models + managers + event handlers)
- `ui-vue/src`: Vue 3 client (Pinia store, composables, phase components)
- `standalone-server/src`: thin standalone Express + Socket.IO wrapper
- `standalone-web/src`: thin standalone Vue app entry

## Key Patterns (Must Follow)

1. Manager pattern

- Keep Socket.IO handlers thin.
- Put business logic into `server/src/managers/*` pure-ish functions operating on `Room`.
- Handlers validate input, call managers, then broadcast.

2. Per-player sanitization

- Always broadcast room state via `broadcastManager`.
- Never emit raw internal room state directly.
- Before reveal, only reader sees category/task/letter; other players receive `null`.

3. Phase-based state machine

- Valid phases: `lobby -> playing -> roundEnd -> ended`.
- Do not mutate phase ad hoc in handlers; use `phaseManager` helpers.
- Keep transition side effects explicit and testable.

## Common Tasks

### Add a new Socket.IO event

1. Add event contract in `core/src/events.ts`.
2. Add server handler in `server/src/socketHandlers.ts`.
3. Implement/reuse logic in `server/src/managers/*`.
4. Update client emitter/listener usage (`ui-vue/src/App.vue` or composables/stores).
5. Add unit tests for manager logic and handler flow.

### Add a new Vue component

1. Create component in `ui-vue/src/components` or `ui-vue/src/panels`.
2. Keep shared game state in Pinia (`ui-vue/src/stores/game.ts`), not duplicated in component-local state.
3. Wire phase rendering in `ui-vue/src/App.vue`.
4. Keep socket interaction centralized in App/store/composables where possible.

### Modify game logic

1. Change shared types/constants first if contract changes (`core/src/*`).
2. Update relevant manager(s) and phase transitions.
3. Preserve broadcast sanitization guarantees.
4. Update unit tests and E2E tests for behavior changes.

## Testing & QA Guidelines

Run these from repo root to ensure CI and Game Hub integration passes:

- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Type checks: `pnpm typecheck` (Crucial for strict Game Hub monorepo compliance)
- Lint and format checks: `pnpm lint && pnpm format:check`

**CRITICAL**: Always ensure `pnpm lint` and `pnpm typecheck` pass successfully before finishing a task or committing.

For gameplay or event-contract changes, run unit + E2E.

## Development Workflow

- Install deps (root + standalone packages): `pnpm install:all`
- Start dev stack: `pnpm dev`
  - server on `:3001`
  - Vite client on `:5173`
- Build standalone production artifacts: `pnpm build`
- Build Game Hub library bundle: `pnpm build:lib`

## Working Rules

- Keep TypeScript strictness intact; avoid `any` unless unavoidable.
- Avoid leaking internal fields (`resumeToken`, `socketId`) to clients.
- Keep docs updated when adding/changing events, phases, or integration behavior.
