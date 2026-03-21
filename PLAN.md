# Game Platform Fusion Plan v2

## Executive Summary

The previous plan was useful as a rough direction, but it was still too anchored in the old `standalone` and `embedded` model. That is not enough for the actual target state: a single platform product where one shared party or lobby can launch multiple games together and return to the lobby afterwards.

The target state is:

- one repository
- one shared product
- one party and lobby system for all players
- multiple games inside the same product
- return from a match back to the shared party lobby
- the existing tech stack remains in place

The existing embedded logic inside the games should only be treated as a migration bridge, not as the final platform architecture.

---

## Non-Negotiable Constraint: Keep the Tech Stack

The platform rewrite must keep the current stack and build on top of it instead of replacing it.

The plan explicitly preserves:

- Vue 3
- Pinia
- Vite
- Express
- Socket.IO
- TypeScript
- pnpm

This means:

- no framework rewrite
- no move to a different frontend stack
- no replacement of Express or Socket.IO
- no forced standardization into a different runtime model

The work is a product and repository fusion, not a stack migration.

---

## Why the Previous Plan Was Not Strong Enough

- It implicitly treated `embedded` as the final model, even though the actual goal is a native platform.
- It described a one-way handoff from lobby to game, but not a proper return path back to the lobby.
- It assumed too early that almost no game code would need changes. That is already false for `secret-signals`, and only partially true for the other two games.
- It pushed too early toward `one package.json for everything` and `one tsconfig for everything`. That adds migration risk without giving enough benefit at this stage.
- It removed `standalone-*`, `vite.lib.config.ts`, game-level `package.json`, and game-level `tsconfig` files too early. That would remove rollback and verification options during the migration.
- It did not define a clean platform domain model for party lifecycle, match lifecycle, reconnect, and return-to-lobby.
- It ignored game-specific operational concerns such as Blackout's SQLite assets and path resolution.

---

## Target Architecture

We will build a workspace monorepo with one central platform app and three internal game modules.

### Target Structure

```text
game-platform/
|-- package.json
|-- pnpm-workspace.yaml
|-- tsconfig.base.json
|-- apps/
|   `-- platform/
|       |-- package.json
|       |-- vite.config.ts
|       |-- src/
|       |   |-- main.ts
|       |   |-- App.vue
|       |   |-- router/
|       |   |-- stores/
|       |   |-- views/
|       |   `-- games/
|       `-- server/
|           |-- index.ts
|           |-- party/
|           `-- registry/
`-- games/
    |-- blackout/
    |-- imposter/
    `-- secret-signals/
```

### Core Principles

- `apps/platform` is the only production app.
- `games/blackout`, `games/imposter`, and `games/secret-signals` remain separate internal modules at first.
- The platform owns party creation, invite codes, host state, player identity, match start, match end, and return to lobby.
- Each game keeps its own gameplay rules, socket handlers, and game-specific setup UI.
- The old `standalone` and `embedded` vocabulary must not define the final product architecture.
- The existing stack stays unchanged: Vue 3, Pinia, Vite, Express, Socket.IO, TypeScript, and pnpm remain the foundation.

---

## Product Flow

### Party Flow

1. One player creates a party.
2. The platform generates an invite code.
3. Other players join the same party through that code.
4. The host selects one of the available games.
5. The platform launches a match for the entire party.
6. All players enter the selected game together.
7. When the match ends, the party has two valid follow-up actions:
   - `Play Again`: restart the same game immediately with the same party
   - `Back to Party`: return the full party to the shared party lobby
8. When a match is aborted, the party returns to the shared party lobby.
9. At no point do players need to create a new lobby or party just to keep playing together.

### Important Consequence

The platform does not only manage entry into a game. It owns the full lifecycle of the shared party before, during, and after each match.

---

## Platform Domain Model

### PartySession

- `partyId`
- `inviteCode`
- `hostPlayerId`
- `members`
- `selectedGameId`
- `activeMatch`
- `status`: `'lobby' | 'launching' | 'in-match' | 'returning'`

### PartyMember

- `playerId`
- `name`
- `connected`
- `socketId`

### PartyMatch

- `gameId`
- `matchKey`
- `namespace`
- `state`
- `startedAt`

### Why `matchKey` Matters

A new match for the same party must not reconnect to an old room instance from the same game. Every launch therefore needs a fresh `matchKey`, even if the party remains the same.

---

## Interfaces

### Platform Server

The platform gets its own party channel for:

- `createParty`
- `joinParty`
- `resumeParty`
- `leaveParty`
- `selectGame`
- `launchGame`
- `replayGame`
- `returnToLobby`
- `ackReturnedToLobby`

`returnToLobby` is a host-only, server-authoritative action. Clients must not navigate the whole party back to the lobby on their own. The server validates that the caller is the current host, captures the active match as the cleanup target, clears the party's resumable in-match state, sets the party status to `'returning'`, and broadcasts a single authoritative party state transition to all connected clients.

`replayGame` is also a host-only, server-authoritative action. It does not create a new party. It creates a fresh match for the currently active game inside the same existing party, broadcasts the new authoritative match state to all connected clients, and keeps the group on the game route.

### Game Modules

Each game is integrated through a consistent adapter surface:

```ts
import type { Component } from 'vue';
import type { Server } from 'socket.io';

interface PlatformGameModule {
  definition: {
    id: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  };
  registerServer: (io: Server, namespacePath: string) => void;
  loadClient: () => Promise<{ default: Component }>;
  cleanupMatch: (matchKey: string) => void;
}
```

The `loadClient` return type matches the shape of a dynamic `import()` call so that game adapters can return `() => import('./GameAdapter.vue')` directly.

### Platform Props for Game Roots

```ts
interface PlatformGameProps {
  matchKey: string;
  playerId: string;
  playerName: string;
  namespace: string;
  apiBaseUrl?: string;
  onReplayGame?: () => void;
  onReturnToLobby?: () => void;
}
```

The platform should not import games directly from raw `App.vue` files. Each game should expose a thin adapter layer instead.

### How `matchKey` Maps to Existing Game Code

Verified against the codebase: both Blackout and Imposter use a `sessionToRoom: Map<string, string>` to map the incoming `sessionId` from `autoJoinRoom` to a game room code. The key is treated as an opaque string with no format validation. The platform passes `matchKey` as the `sessionId` value and the existing game code works without modification. A fresh `matchKey` per match guarantees that a replay does not reconnect to a stale room.

### Match Cleanup Contract

Returning to the party lobby must not rely on existing idle cleanup timers alone. Each game adapter must implement `cleanupMatch(matchKey)` so the platform can actively tear down the old match once the return-to-lobby transition has completed.

That cleanup step must:

- resolve the game room associated with the old `matchKey`
- delete the old room immediately
- remove any `sessionId -> roomCode` mapping associated with that match
- ensure later reconnects resume into the party lobby instead of the old game

The same cleanup contract also applies when the party chooses `Play Again`: the old finished match is torn down once the new match has been launched and all connected players have transitioned into it.

---

## How to Treat the Existing Games

### Blackout

- Can be reused substantially as-is.
- Needs a platform adapter for its current server and UI structure.
- Its SQLite database and asset paths must continue to work in the workspace layout. Verified: `database.ts` already contains a fallback path for `path.join('games', 'blackout', 'server', 'src', 'db', ...)`, so the monorepo layout is anticipated.
- That is one of the main reasons not to force everything into a single root `package.json` and immediately flatten all configuration.
- Server adapter note: Blackout's `register()` takes a `Namespace` object (`io.of(path)`), not a string. The server adapter must call `io.of(namespacePath)` before delegating.
- Client adapter note: Blackout broadcasts game state via `roomUpdate` events.

### Imposter

- Is already relatively close to the desired runtime behavior.
- Can serve as a reference for auto-join and reconnect handling.
- Still needs a proper platform adapter and the move from hub-style thinking to party-and-match thinking.
- Server adapter note: Imposter's `register()` takes an optional string namespace path. The adapter can pass the path directly.
- Client adapter note: Imposter broadcasts game state via `roomState` events.

### Secret Signals

- Is not yet at the same integration level as Imposter and Blackout.
- Needs the missing runtime bootstrap for platform-driven start, auto-join, and reconnect.
- Its current `HubIntegrationProps` shape exists, but the runtime behavior is not yet fully aligned with the intended platform flow.
- Server adapter note: same string-based `register()` as Imposter.
- Client adapter note: Secret Signals broadcasts game state via `roomState` events.
- Cleanup note: its room cleanup path must be aligned with the platform cleanup contract so old room state and any future session mapping cannot survive a party return.

### Broadcast Event Inconsistency

The games do not use the same event name for state updates:

| Game           | Broadcast Event |
| -------------- | --------------- |
| Blackout       | `roomUpdate`    |
| Imposter       | `roomState`     |
| Secret Signals | `roomState`     |

All three include `phase: 'ended'` when a match is over. Each client adapter must know which event to listen for to detect game-end. This is not a blocker but it means the adapters are necessarily game-specific rather than generic.

---

## Migration Strategy

### Progress Tracking

Each phase must be accompanied by a `PROGRESS.md` in the repository root. This file is updated continuously during implementation, not just at the end of a phase. It tracks:

- which phase is currently active
- which steps within that phase are done, in progress, or open
- decisions made during implementation that deviate from or refine the plan
- blockers or open questions

The file is the single source of truth for the current state of the migration. Every implementation session must start by reading it and end by updating it.

### Phase 1: Monorepo Without Breaking the Existing Games

- Create the workspace root.
- Create `apps/platform`.
- Move the three games under `games/` as internal modules.
- Do not immediately strip the existing game repositories down.
- Keep the current stack and current build tooling in place.

### Phase 2: Build Platform Orchestration

- Build the party store on the server side.
- Implement invite-code flows.
- Implement reconnect for party members. When a player refreshes during a match, the `resumeParty` handler returns the active `matchKey` and `gameId` so the client can re-mount the game component and call `autoJoinRoom` with the same `matchKey`.
- Introduce match lifecycle handling through `activeMatch`.
- Validate party size against `definition.minPlayers` / `definition.maxPlayers` at launch time.
- Keep using Express and Socket.IO for orchestration. Do not replace the runtime model.

### Phase 3: Integrate Games Through Adapters

- Build a server adapter for each game. The adapter normalizes the `register()` signature difference: Blackout expects a `Namespace` object, Imposter and Secret Signals expect a string path.
- Build a client adapter for each game. The adapter wraps the game `App.vue`, passes `PlatformGameProps`, and listens for the game-specific broadcast event (`roomUpdate` or `roomState`) to detect `phase: 'ended'`.
- Let the platform launch games only through those adapters.
- Keep the game-specific setup screens where they matter. After `autoJoinRoom`, players land in the game's own lobby screen (Blackout: language and letter config, Imposter: infiltrator count, Secret Signals: team setup). This is intentional and not a bug.
- Remove game-owned create and join landing flows from the user-facing product path. The `Landing.vue` component in each game is bypassed because `autoJoinRoom` skips directly to the game lobby.
- At the end of a match, the adapter must surface two party-level actions for the host:
  - `Play Again`
  - `Back to Party`
- The adapter must not allow a game-local restart to silently create a separate game-owned room outside the party lifecycle.

### Phase 4: Post-Match Flow Inside the Same Party

- When a match ends, the client adapter detects `phase: 'ended'` from the game broadcast.
- The adapter does not navigate away automatically. Players see the game's own `GameOver.vue` scoreboard first.
- The adapter replaces the game's standalone restart behavior with two host-only party-level actions:
  - `Play Again`
  - `Back to Party`
- `Play Again` calls `onReplayGame()`.
- `Back to Party` calls `onReturnToLobby()`.
- `onReplayGame()` triggers the platform `replayGame` event. The server validates that the caller is the current host, keeps the same party, creates a fresh `matchKey` for the same game, clears the previous resumable in-match state, and broadcasts one authoritative new-match transition to all connected clients.
- Clients stay on `/party/:inviteCode/game/:gameId`, re-mount the game with the fresh `matchKey`, and reconnect through `autoJoinRoom` into the new match.
- Once all currently connected party members have transitioned into the new match, the platform calls `cleanupMatch(previousMatchKey)` and immediately tears down the old finished game room.
- `onReturnToLobby()` triggers the platform `returnToLobby` event. The server validates that the caller is the current host and performs the transition authoritatively.
- The server sets the party status to `'returning'`, clears the party's resumable in-match state, and broadcasts one party state transition to every connected client.
- Clients navigate back to `/party/:inviteCode` only in response to that server broadcast, not because a local component decided to route away.
- Each connected client acknowledges the completed route transition through `ackReturnedToLobby`.
- Once all currently connected party members have acknowledged the lobby transition, the platform calls the game adapter's `cleanupMatch(matchKey)` hook and immediately tears down the old game room.
- Disconnected party members are treated as returning to the lobby on next resume because the party no longer exposes an active resumable match.
- After cleanup finishes, the server sets the party status to `'lobby'`.
- The party remains intact in both cases. Players never need to create a new lobby or party just to keep playing together.
- Every new match receives a new `matchKey`.

### Phase 5: Remove Legacy Artifacts

Only after platform parity is stable:

- `standalone-web`
- `standalone-server`
- hub-specific sync artifacts
- duplicate configuration that is no longer needed
- old `embedded` naming where it is no longer required for migration compatibility

---

## Important Technical Decisions

### Monorepo Topology

Do not do a hard flatten into a single root `package.json` with no boundaries. Instead:

- one repository
- one shared product
- multiple internal workspace modules

That matches the product goal better and keeps migration risk lower while still preserving the current stack.

### Routing

Planned product routes:

- `/`
- `/party/:inviteCode`
- `/party/:inviteCode/game/:gameId`

### Namespaces

The platform party channel uses the `/party` namespace. Each game keeps its own namespace:

- `/party` (platform party lifecycle)
- `/g/blackout`
- `/g/imposter`
- `/g/secret-signals`

This is intentionally migration-friendly and lets us reuse the current Socket.IO-based game servers instead of replacing them.

### Import Strategy

Do not treat an importer-sensitive `@shared` resolver as the long-term architecture. A temporary compatibility layer is acceptable during migration, but the intended end state is:

- clear game-local imports
- or explicit game-specific aliases

### Tooling Strategy

Keep the current toolchain shape unless there is a concrete blocker:

- `pnpm` remains the package manager
- `TypeScript` remains the typed integration layer
- `Vite` remains the frontend bundler and dev server
- `Express` remains the HTTP server shell
- `Socket.IO` remains the real-time transport layer

This is a consolidation plan, not a tooling rewrite.

---

## Implementation Order

1. Create the workspace root with `pnpm-workspace.yaml`, shared TypeScript base config, and root scripts.
2. Create `apps/platform` as the central app using the existing stack.
3. Implement the party domain model and party socket flow in the platform server.
4. Define the game registry and the `PlatformGameModule` interface.
5. Build adapters for `blackout`, `imposter`, and `secret-signals`.
6. Build the platform UI for party creation, joining, host game selection, and launch flow with Vue 3 and Pinia.
7. Stabilize party-to-game handoff for all three games.
8. Stabilize reconnect behavior during active matches.
9. Implement post-match actions for replaying the same game and returning to the party lobby.
10. Add platform integration tests on top of the existing game-level test strategy.
11. Only then remove `standalone-*` and other obsolete legacy artifacts.

---

## Test Plan

### Party Tests

- Host creates a party.
- Guests join through invite code.
- Reload or reconnect restores party state.
- Host transfer or disconnect behaves predictably.

### Game Handoff Tests

- Full party launches into Blackout together.
- Full party launches into Imposter together.
- Full party launches into Secret Signals together.

### Match Lifecycle Tests

- Refresh during a match keeps the same player slot. The `resumeParty` handler returns the active `matchKey` and `gameId`, the client re-mounts the game component, and `autoJoinRoom` reconnects with the same `matchKey`.
- End of game shows the scoreboard first. The party stays intact after the match.
- Only the host can trigger `Play Again`.
- `replayGame` is server-authoritative: one host action produces one party-wide new-match transition for the same game, using a fresh `matchKey`, without creating a new party.
- All connected clients stay on the game route and rejoin the fresh match for the same game.
- Only the host can trigger `Back to Party`.
- `returnToLobby` is server-authoritative: one host action produces one party-wide transition broadcast, and all connected clients return to the party lobby from that broadcast.
- Abort returns the party to the lobby.
- The same party can immediately start another match afterwards.
- The same party can start the same game again without reconnecting to an old room mapping. The fresh `matchKey` guarantees isolation.
- After `Play Again`, the previous finished game room and its session mapping are cleaned up immediately once the connected players have transitioned into the fresh match.
- After `Back to Party`, the previous game room and its session mapping are cleaned up immediately once the connected players have transitioned back to the lobby.

### Regression

- Existing unit tests for the games remain runnable.
- Existing game E2E tests remain possible, at least during migration.
- New platform E2E tests validate party-to-game and return-to-lobby behavior.

### Blackout-Specific

- SQLite database files and related assets still work in both workspace development and production build output.

---

## Explicitly Out of Scope for V1

- user accounts
- persistent player profiles
- global friend lists
- matchmaking with strangers
- cross-server persistence
- forced internal UI unification across all games
- framework or runtime migration away from the existing stack

V1 is a shared party-and-game platform for the existing games in one repository, using the existing technology choices.

---

## Assumptions

- The current tech stack stays in place: Vue 3, Pinia, Vite, Express, Socket.IO, TypeScript, and pnpm.
- The platform is initially a single deployment unit.
- Parties and active matches can stay in memory in V1.
- Direct access to individual games may still exist locally as a debug harness during migration, but it is not a primary product flow.
- Existing embedded logic may be reused as a bridge, but only as a bridge into the new platform runtime.

---

## Final Target in One Sentence

One repository containing a real party-based platform where multiple games can be launched together from the same shared lobby and where the full party returns to that same lobby after each match, without changing the current tech stack.
