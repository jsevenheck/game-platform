# Migration Progress

## Current Phase: Phase 1–3 complete (initial implementation session)

---

## Phase 1: Monorepo Without Breaking the Existing Games

### Status: Complete

- [x] Created root `package.json` with workspace scripts
- [x] Created `pnpm-workspace.yaml` (`apps/*`, `games/*`)
- [x] Created `tsconfig.base.json`
- [x] Moved `blackout/` → `games/blackout/` (git mv)
- [x] Moved `imposter/` → `games/imposter/` (git mv)
- [x] Moved `secret-signals/` → `games/secret-signals/` (file copy + git rm original)
- [x] Created `apps/platform/` directory and package

**Pending (Phase 5 scope, deliberately deferred):**

- Game-level config files (tsconfig, jest, playwright, prettier, eslint) stay per-game for now — consolidation deferred to Phase 5 per plan guidance. Root-level `.prettierrc`/`.gitignore` can be added as a separate cleanup step.

---

## Phase 2: Build Platform Orchestration

### Status: Complete

- [x] Party domain model (`PartySession`, `PartyMember`, `PartyMatch`) in `apps/platform/server/party/types.ts`
- [x] Party store (`apps/platform/server/party/partyStore.ts`) — in-memory, indexed by partyId, inviteCode, socketId
- [x] Party socket handlers (`apps/platform/server/party/partyHandlers.ts`) — `/party` namespace with all required events: `createParty`, `joinParty`, `resumeParty`, `leaveParty`, `selectGame`, `launchGame`, `replayGame`, `returnToLobby`, `ackReturnedToLobby`
- [x] Server entry point (`apps/platform/server/index.ts`) — registers all game namespaces + party handlers

---

## Phase 3: Integrate Games Through Adapters

### Status: Complete

- [x] Added `cleanupMatch(matchKey)` export to `games/blackout/server/src/index.ts`
- [x] Added `cleanupMatch(matchKey)` export to `games/imposter/server/src/index.ts`
- [x] Added `autoJoinRoom` socket handler to `games/secret-signals/server/src/handlers/socketHandlers.ts`
- [x] Fixed `deleteRoom` in `games/secret-signals/server/src/models/room.ts` to also clear `sessionToRoom` mappings
- [x] Added `cleanupMatch(matchKey)` export to `games/secret-signals/server/src/index.ts`
- [x] Added `autoJoinRoom` event to `games/secret-signals/core/src/events.ts`
- [x] Updated `createPlayer` in Secret Signals to accept optional stable player ID
- [x] Updated Secret Signals `App.vue` to support embedded/platform mode (HubIntegrationProps + autoJoinRoom flow)
- [x] Updated Secret Signals `useSocket` composable to accept `wsNamespace` option
- [x] Server registry (`apps/platform/server/registry/index.ts`) — `GameServerModule` interface, adapters for all 3 games, Blackout namespace-object normalization handled
- [x] Client game registry (`apps/platform/src/games/index.ts`) — dynamic `loadClient()` per game
- [x] Client adapters for Blackout, Imposter, Secret Signals (`PlatformAdapter.vue` in each game's `ui-vue/src/`)

---

## Platform Client

### Status: Complete

- [x] `apps/platform/src/main.ts` — Pinia + Vue Router setup
- [x] `apps/platform/src/App.vue` — RouterView wrapper
- [x] `apps/platform/src/router/index.ts` — routes: `/`, `/party/:inviteCode`, `/party/:inviteCode/game/:gameId`
- [x] `apps/platform/src/stores/party.ts` — Pinia party store with session persistence
- [x] `apps/platform/src/composables/usePartySocket.ts` — typed socket composable for `/party` namespace
- [x] `apps/platform/src/views/HomeView.vue` — create/join party UI
- [x] `apps/platform/src/views/PartyView.vue` — party lobby with game selection and launch
- [x] `apps/platform/src/views/GameView.vue` — game runner with match key, replay, return-to-lobby
- [x] `apps/platform/vite.config.ts` — context-sensitive `@shared` alias resolver handles all 3 games

---

## V3 Consolidation: Root-Centered Monorepo

### Status: Complete (2026-03-20)

Per PLAN_V3.md — games are now internal source modules, not independent products.

**Removed from all 3 games:**

- [x] `standalone-server/` and `standalone-web/`
- [x] `hub.config.json`, `.mcp.json`, `AGENTS.md`, `Dockerfile`, `.dockerignore`
- [x] `.gitignore`, `.prettierrc`, `.prettierignore`, `.gitattributes` (root versions handle these)
- [x] `eslint.config.mjs`, `jest.config.cjs`, `jest.setup.ts`, `playwright.config.ts`
- [x] `tsconfig.json`, `tsconfig.jest.json`, `tsconfig.client.json`, `tsconfig.playwright.json`, `tsconfig.server.json`
- [x] `pnpm-lock.yaml`
- [x] `ui-vue/package.json`, `ui-vue/vite.config.ts`, `ui-vue/vite.lib.config.ts`, `ui-vue/index.html`
- [x] Empty `global.d.ts` from imposter + secret-signals

**What remains per game (minimum necessary):**

- `core/`, `server/`, `ui-vue/src/`, `__tests__/`, `e2e/`, `docs/`, `README.md`
- `package.json` — `{ name, private, type: commonjs }` — workspace marker only
- `global.d.ts` — blackout only (mp3 type declaration)
- `scripts/` — blackout only (db import scripts)
- `ui-vue/tsconfig.json` — each game's `@shared/*` → own `core/src/`; needed because `@shared` is game-scoped
- `ui-vue/env.d.ts` — `/// <reference types="vite/client" />`

**Created at root:**

- [x] `jest.config.cjs` — 3 jest projects (inline tsconfig, `moduleNameMapper` handles `@shared`)
- [x] `eslint.config.mjs` — covers all server + Vue + test source, `projectService: true`
- [x] `.prettierrc`, `.gitignore`, `.gitattributes`
- [x] `playwright.config.ts` — points at platform server/client (e2e tests need updating for platform flow)
- [x] `tsconfig.json` — root TypeScript config covering game server/core/test code for IDE + ESLint
- [x] `package.json` — `better-sqlite3` as dep (must be at root so Node finds it from `games/blackout/server/src/`), all devDeps, full script surface

---

---

## Post-Consolidation Stabilization

### Status: Complete (2026-03-20)

- [x] Moved `express`, `nanoid`, `socket.io` to root `package.json` dependencies — game server files now resolve them via workspace root `node_modules/`
- [x] Root `tsconfig.json`: added `apps/platform/server/**/*` and `games/blackout/global.d.ts` to include; narrowed exclude from `"apps"` to `"apps/platform/src"` so ESLint project service discovers platform server files
- [x] ESLint `allowDefaultProject` scoped to `['apps/platform/vite.config.ts']` only
- [x] Removed unused `watch` import from `GameView.vue` and `PartyView.vue`
- [x] Removed unused `gameRegistry` import from `partyHandlers.ts`
- [x] Fixed `vue/attributes-order` in `GameView.vue`
- [x] `pnpm format` — all files formatted to root `.prettierrc` standard
- [x] `pnpm typecheck` → exit 0
- [x] `pnpm lint` → exit 0
- [x] `pnpm dev` → server starts, all 3 games registered on `/g/{game}`, Vite client on port 5173
- [x] `pnpm test` → 92 unit tests pass across all 3 games

---

## E2E Test Rewrite

### Status: Complete (2026-03-20)

All three `games/*/e2e/game.spec.ts` files rewritten for the platform flow.

**Shared platform helpers in each spec:**
- `createParty(page, name)` → fills name, submits → returns invite code from `.code`
- `joinParty(page, name, inviteCode)` → switches to Join Party tab, fills fields, submits
- `launchGame(hostPage, gameName)` → clicks game card, clicks Launch Game, waits for `/game/` URL

**Coverage per game:**
- **Blackout**: launch + game start, platform overlay → return to party
- **Imposter**: all original gameplay tests (full round, end game, next round, paranoia mode, guess skip, session resume, replay via overlay)
- **Secret Signals**: platform home, opening turn, assassin toggle, session resume, guess skip, disconnect rejoin, overlay → return to party

**Key behaviour changes tested:**
- `createRoom`/`joinRoom` replaced with `createParty`/`joinParty`/`launchGame`
- After launch, all players navigate to `/party/:inviteCode/game/:gameId` automatically
- Game loads in embedded mode (autoJoinRoom via matchKey)
- Post-match: platform overlay shows `.btn-replay` and `.btn-lobby` instead of in-game controls
- Session resume: reload → `resumeParty` → back to `/party/:inviteCode` (or game if match active)

---

## Bug Fixes Found During E2E Testing

### Status: In Progress (2026-03-20 → paused 2026-03-21)

E2E tests revealed two bugs. First is fixed, second is partially done.

#### Bug 1: Vite `@shared` alias broken on Windows — FIXED

The original `customResolver` in vite.config.ts alias entries was broken because:
1. Rollup's alias plugin passes the already-replaced source (e.g. `/constants`) rather than the original `@shared/constants` to the custom resolver.
2. On Windows, `resolve(base, '/constants')` produces `C:/constants`.
3. Backslash paths in the `importer` argument didn't match forward-slash game directory checks.

**Fix:** Replaced the alias `customResolver` approach with a proper Vite plugin (`sharedAliasPlugin()`) using the `resolveId` hook. The plugin normalizes backslashes, checks `source.startsWith('@shared')`, determines the game from the importer path, and delegates to `this.resolve()` for proper `.ts` extension handling.

- [x] `apps/platform/vite.config.ts` — new `sharedAliasPlugin()` replaces broken alias entries
- [x] `pnpm typecheck` still passes
- [x] `pnpm lint` still passes (after format)

#### Bug 2: Non-deterministic host assignment in games — IN PROGRESS

When the platform launches a game, all players race to emit `autoJoinRoom`. The first player to connect creates the room and becomes host — but that player may not be the platform host. This causes E2E tests to fail because they expect the platform host to also be the game host.

**Solution:** Thread an `isHost` flag from platform → PlatformAdapter → App.vue → `autoJoinRoom` socket event → server handler. The server transfers host when a player with `isHost: true` arrives.

**Completed (all 3 games):**
- [x] `games/*/core/src/events.ts` — added `isHost?: boolean` to autoJoinRoom data type
- [x] `games/*/ui-vue/src/types/config.ts` — added `isHost?: boolean` to `HubIntegrationProps`
- [x] `games/*/ui-vue/src/App.vue` — added `isHost` to `withDefaults` + autoJoinRoom emit data
- [x] `games/*/ui-vue/src/PlatformAdapter.vue` — passes `:is-host="isHost"` to GameApp

**Server-side host transfer — per game:**
- [x] `games/blackout/server/src/socketHandlers.ts` — reads `data.isHost`, calls `assignHost(room, playerId)` for reconnecting and new-joining players when `wantsHost` is true
- [ ] `games/imposter/server/src/handlers/socketHandlers.ts` — needs same pattern, using existing `setHost(room, playerId)` from `models/room.ts`
- [ ] `games/secret-signals/server/src/handlers/socketHandlers.ts` — needs same pattern; no `setHost()` utility exists, requires inline host transfer logic (`room.hostId = player.id` + update `isHost` flags)

**Also fixed during this session (2026-03-21):**
- [x] `PlatformAdapter.vue` (all 3 games): replaced broken monitor-socket approach with `@phase-change` event. The monitor socket never received room events (Blackout broadcasts to socket.io room which requires membership; Imposter/SS broadcast to specific player sockets only).
- [x] `games/*/ui-vue/src/App.vue`: added `defineEmits<{ 'phase-change': [phase: string] }>()`, emit on every room state update
- [x] Secret Signals e2e test: fixed strict mode violation — `getByRole('button', { name: 'Create Party' })` changed to `page.locator('button.tab', { hasText: 'Create Party' })` (submit button also says "Create Party" in create mode)
- [x] `pnpm lint` → exit 0, `pnpm typecheck` → exit 0, `pnpm test` → 92/92 pass

**Still TODO:**
- [ ] Complete Imposter + Secret Signals `autoJoinRoom` server handler fixes (Bug 2)
- [ ] Run `pnpm lint` + `pnpm typecheck` after all server changes
- [ ] Run full `pnpm test:e2e` to verify all 16 pass
- [ ] Investigate Imposter "duplicate name" test (fails at `waitForSelector('.code')` timeout — might clear up after Bug 2 fix)

## Next Steps

1. Fix Bug 2 server-side for Imposter: add `isHost`-based host transfer to `autoJoinRoom` handler in `games/imposter/server/src/handlers/socketHandlers.ts`
2. Fix Bug 2 server-side for Secret Signals: same in `games/secret-signals/server/src/handlers/socketHandlers.ts`
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` — expect all 16 e2e to pass

---

## Decisions Made During Implementation

- Server adapters live in `apps/platform/server/registry/index.ts` (one file, all three games).
- Client adapters (`PlatformAdapter.vue`) live in each game's `ui-vue/src/` directory.
- Platform imports game server code using relative paths (not workspace package references).
- `matchKey` is passed as `sessionId` to each game's `autoJoinRoom` handler.
- Blackout's `register()` takes a `Namespace` object — the server adapter calls `io.of(namespacePath)` before delegating.
- Imposter and Secret Signals' `register()` accept a string path directly.
- Vite `@shared` alias in platform uses a `customResolver` function that resolves to the correct game's `core/src/` based on which game's directory the importing file comes from.
- `PlatformAdapter.vue` detects game-end via a `@phase-change` event emitted by each game's `App.vue` on every room state update (earlier monitor-socket approach was replaced because the monitor socket never received room events).
- Secret Signals needed: `autoJoinRoom` handler, `deleteRoom` sessionToRoom cleanup, `createPlayer` stable-id support, `useSocket` `wsNamespace` option, App.vue embedded mode.
- Game-level config files consolidated at root (V3 consolidation complete). Only `ui-vue/tsconfig.json` remains per-game due to game-scoped `@shared` path aliasing.

---

## Open Questions / Blockers

- `games/*/e2e/` tests target the old standalone game flow and need to be rewritten for the platform flow.
- The `@blackout-client`, `@imposter-client`, `@secret-signals-client` aliases in the old `registry/index.ts` were replaced with proper `@blackout-ui`, `@imposter-ui`, `@secret-signals-ui` Vite aliases.
- Blackout's `server/src/socketHandlers.ts` uses `bindPlayerToSocket` — this is an internal function verified to exist; the `cleanupMatch` import of `getSessionRoom`/`deleteRoom` is from the same module and correct.
