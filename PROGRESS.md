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

## Phases 4 and 5: Post-Match Flow and Legacy Removal

### Status: Not Started

Phase 4 (post-match flow) is partially covered by the PlatformAdapter overlays and platform server `replayGame`/`returnToLobby` handlers.

Phase 5 (remove standalone-*, hub artifacts) will only happen once platform parity is stable.

---

## Next Steps

1. Run `pnpm install` at workspace root to install all dependencies
2. Run `pnpm dev` to start the platform in development mode
3. Verify party creation, join, game launch, replay, and return-to-lobby flows
4. Fix any issues that surface during testing
5. Add root-level `.prettierrc`, `.gitignore`, `eslint.config.mjs` to reduce per-game config duplication (cosmetic cleanup, low risk)
6. Phase 5: remove `standalone-*` after verifying platform parity

---

## Decisions Made During Implementation

- Server adapters live in `apps/platform/server/registry/index.ts` (one file, all three games).
- Client adapters (`PlatformAdapter.vue`) live in each game's `ui-vue/src/` directory.
- Platform imports game server code using relative paths (not workspace package references).
- `matchKey` is passed as `sessionId` to each game's `autoJoinRoom` handler.
- Blackout's `register()` takes a `Namespace` object — the server adapter calls `io.of(namespacePath)` before delegating.
- Imposter and Secret Signals' `register()` accept a string path directly.
- Vite `@shared` alias in platform uses a `customResolver` function that resolves to the correct game's `core/src/` based on which game's directory the importing file comes from.
- `PlatformAdapter.vue` for each game creates a second "monitor" socket connection to the game namespace to detect `phase: 'ended'` without modifying the game's App.vue socket handling.
- Secret Signals needed: `autoJoinRoom` handler, `deleteRoom` sessionToRoom cleanup, `createPlayer` stable-id support, `useSocket` `wsNamespace` option, App.vue embedded mode.
- Game-level config files (tsconfig, jest, playwright) kept per-game. Consolidation is Phase 5.

---

## Open Questions / Blockers

- `pnpm install` at workspace root has not yet been run — dependencies not yet resolved.
- The `@blackout-client`, `@imposter-client`, `@secret-signals-client` aliases in the old `registry/index.ts` were replaced with proper `@blackout-ui`, `@imposter-ui`, `@secret-signals-ui` Vite aliases.
- Blackout's `server/src/socketHandlers.ts` uses `bindPlayerToSocket` — this is an internal function verified to exist; the `cleanupMatch` import of `getSessionRoom`/`deleteRoom` is from the same module and correct.
