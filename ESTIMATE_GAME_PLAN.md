# Estimate Game — Implementation Plan

> **Status:** Implementation complete; runtime, E2E and documentation follow-up fixes validated locally
> **Branch:** `feat/estimate-game` (from `main` @ `43af1a8`)
> **Author:** Hermes Agent
> **Date:** 2026-07-27
> **Game-ID:** `estimate`

---

## 1. Concept (Jona's Brief, distilled)

A new game in the **game-platform** repo. The host is just another player
(no special setup screen). The platform party flow is unchanged.

**Per round:**

1. Server broadcasts the current question (text only — e.g.
   _„In welchem Jahr fiel die Berliner Mauer?"_).
2. Each player types **one numeric guess** (integer or decimal) and submits.
3. Once **all** players have submitted, the UI shows a **horizontal number
   line** with one marker per player. The solution is **NOT** revealed yet.
4. The host (who is also a player and submitted a guess) presses a single
   **"Auflösen"** button.
5. The solution is added to the same number line as a second, clearly
   distinguishable marker. All player markers stay in place. No reordering,
   no color changes of existing markers.
6. The player(s) with the **smallest absolute difference** to the solution
   score **+1 point** for the round. Ties: every tied player gets +1.
7. A "Nächste Frage" button (host only) advances. After the last question,
   the game ends, points are revealed, and the platform shows the standard
   "Play Again / Back to Party" overlay.

**Scaling rule (clarified 2026-07-27 by Jona):** the UI **automatically**
computes the visible number range from the players' guesses:
`lo = min(guesses) − 10% × span`, `hi = max(guesses) + 10% × span`, with
`span = max(guesses) − min(guesses)` and a small absolute floor (so the bar
never collapses to a single point). If the solution lies outside that
range, the server **extends** the bar so the solution marker stays
visible — never silently clip it.

## 2. Data: CSV Format

File: `games/estimate/server/data/questions.csv` (bundled with the game,
like `games/imposter/server/data/words.txt`).

**Format:** Two columns, comma-separated, optional UTF-8 BOM, header row
required, one question per line. `#`-prefixed lines are comments.

```csv
question,answer
"In welchem Jahr fiel die Berliner Mauer?",1989
"Wie viele Planeten hat unser Sonnensystem?",8
"Welche Geschwindigkeit (km/h) erreicht ein Gepard im Sprint?",120
"Wie hoch (in Metern) ist der Eiffelturm?",330
"Wie viele Knochen hat ein erwachsener Mensch?",206
```

**Validation (server, on load):** `answer` must parse as a finite JS number
(no `NaN`, no `Infinity`, decimal separator is `.`); empty file → fall back
to `DEFAULT_QUESTIONS` in `core/src/constants.ts` (mirrors imposter's
`DEFAULT_WORD_LIBRARY` pattern). Loaded **once at server start**, cached.

## 3. Implementation Checklist

> Each box is one commit. Mark `[x]` when the commit is pushed.

### Phase 0 — Scaffold

- [x] `games/estimate/package.json` (workspace pkg, `type: commonjs`)
- [x] `games/estimate/core/src/types.ts`
- [x] `games/estimate/core/src/constants.ts` (`MIN_PLAYERS=2`, `MAX_PLAYERS=12`, `DEFAULT_QUESTIONS`, `DEFAULT_TOTAL_ROUNDS=5`)
- [x] `games/estimate/core/src/events.ts` (C2S / S2C maps)
- [x] `games/estimate/core/src/range.ts` (shared display-range helper used by server + client)
- [x] No timer config: Estimate intentionally has no automatic or cosmetic guess countdown.
- [x] `games/estimate/server/src/index.ts` (stub: `definition`, `register`, `cleanupMatch`)
- [x] `games/estimate/ui-vue/tsconfig.json` + `ui-vue/env.d.ts`
- [x] `games/estimate/ui-vue/src/App.vue` (placeholder)
- [x] `games/estimate/ui-vue/src/PlatformAdapter.vue` (placeholder)
- [x] **Wiring:** `apps/platform/server/registry/index.ts` (import + add to `gameRegistry`)
- [x] **Wiring:** `apps/platform/src/games/index.ts` (append to `clientGameRegistry`)
- [x] **Wiring:** `apps/platform/vite.config.ts` (`@estimate-ui` alias + `else if` in `sharedAliasPlugin`)
- [x] **Wiring:** `apps/platform/env.d.ts` (declare `@estimate-ui/PlatformAdapter.vue`)
- [x] **Wiring:** `apps/platform/src/styles/main.css` (--color-estimate tokens)
- [x] **Wiring:** `vitest.projects.ts` (add `estimateProject`)
- [x] **Wiring:** `package.json` (`"test:estimate": "vitest run --project estimate"`)
- [x] **Wiring:** `Dockerfile` (COPY `games/estimate/package.json` in both stages)
- [x] **Validation:** `pnpm install` + `pnpm typecheck` clean
- [x] **Validation:** `pnpm lint` clean
- [x] **Commit:** `chore(estimate): scaffold new game`

### Phase 1 — CSV loader

- [x] `games/estimate/server/src/utils/questionLibrary.ts` (load CSV, fallback, validation, cache)
- [x] `games/estimate/server/data/questions.csv` (≥10 seed questions, DE/EN mix)
- [x] `games/estimate/__tests__/questionLibrary.test.ts`
- [x] **Validation:** `pnpm test:estimate` (17/17 passed)
- [x] **Validation:** `pnpm test` (full suite, 289/289 passed — no regressions)
- [x] **Commit:** `feat(estimate): csv question loader`

### Phase 2 — Server core (room, player, round, score)

- [x] `games/estimate/server/src/models/player.ts` (createPlayer, socket index)
- [x] `games/estimate/server/src/models/room.ts` (room store, attach/detach, RoomFullError)
- [x] `games/estimate/server/src/managers/scoreManager.ts` (`computeRoundWinners`, pure)
- [x] `games/estimate/server/src/managers/roundManager.ts` (`startGame`, `submitGuess`, `revealSolution`, `nextRound`, `restartGame`, EstimateError)
- [x] `games/estimate/server/src/managers/broadcastManager.ts` (`buildRoomView`)
- [x] `games/estimate/__tests__/scoreManager.test.ts` (7 tests)
- [x] `games/estimate/__tests__/roundManager.test.ts` (25 tests, covers broadcast + room)
- [x] **Validation:** `pnpm test:estimate` (49/49 passed)
- [x] **Validation:** `pnpm test` (321/321 passed — no regressions)
- [x] **Validation:** `pnpm typecheck` clean
- [x] **Validation:** `pnpm lint` clean
- [x] **Commit:** `feat(estimate): round lifecycle and scoring`

> Phase 2 introduced a new game phase: `allSubmitted` (all players have guessed
> but the host has not yet pressed Auflösen). This keeps the "show all markers
> on the number line, solution still hidden" semantics clean and makes the
> broadcast view stable: it exposes the same shape, only the `solution` field
> switches from `null` to the actual number.

### Phase 3 — Socket handlers

- [x] `games/estimate/server/src/socketHandlers.ts` (`registerEstimate`, `autoJoinRoom`, `startGame`, `submitGuess`, `revealSolution`, `nextRound`, `restartGame`)
- [x] `games/estimate/__tests__/socketHandlers.test.ts` (19 tests covering auth, host-gating, validation)
- [x] `games/estimate/core/src/events.ts` (added `startGame` event)
- [x] `games/estimate/server/src/models/room.ts` (added `hostPlayerId` option to `createRoom` for first-join binding)
- [x] **Validation:** `pnpm test:estimate` (68/68 passed)
- [x] **Validation:** `pnpm test` (340/340 passed — no regressions)
- [x] **Validation:** `pnpm typecheck` clean
- [x] **Validation:** `pnpm lint` clean
- [x] **Commit:** `feat(estimate): socket handlers`

> Phase 3 introduced an important fix: the first room-creation now binds the
> room's host to the platform-authoritative `authorizedPlayerId` via the new
> `hostPlayerId` option on `createRoom`. Without it, the host reconnects would
> fail with 'Name already taken' because the room's first player was a fresh
> nanoid rather than the platform's player id. The same fix flows naturally
> into the existing-player rejoin branch.

### Phase 4 — UI shell

- [x] `games/estimate/ui-vue/src/stores/game.ts` (Pinia store: room, players, phase, error)
- [x] `games/estimate/ui-vue/src/composables/useSocket.ts` (typed socket.io client, normalized namespace)
- [x] `games/estimate/ui-vue/src/App.vue` (root: socket, phase routing, emits `phase-change`)
- [x] `games/estimate/ui-vue/src/PlatformAdapter.vue` (game-end overlay for the host / guests)

### Phases 4–6 — UI shell and game views

- [x] `games/estimate/ui-vue/src/stores/game.ts` and `composables/useSocket.ts`
- [x] `games/estimate/ui-vue/src/App.vue` and `PlatformAdapter.vue`
- [x] `Lobby.vue`, `QuestionView.vue`, `WaitingView.vue`
- [x] `RevealView.vue`, `NumberLine.vue`, `GameOver.vue`
- [x] Numeric input normalization for browser `type="number"` values
- [x] Host-gated controls and standard platform game-end overlay
- [x] **Validation:** typecheck, lint, unit tests and live E2E coverage
- [x] **Commit:** `feat(estimate): ui shell and game views` (`77c2936`)

### Phase 7 — E2E

- [x] Happy path and host-is-player flow
- [x] Host-only reveal enforcement
- [x] Tie resolution
- [x] Multiple rounds and final game-over / replay overlay
- [x] **Validation:** Estimate Playwright suite (4 scenarios)
- [x] **Commits:** `test(estimate): add playwright e2e` (`f6d3a56`) plus follow-up E2E/runtime fixes

### Phase 8 — Docs

- [x] `games/estimate/README.md` (user guide + dev commands + adding questions)
- [x] `games/estimate/docs/architecture.md` (phase machine, modules, host-gating, first-join fix)
- [x] `games/estimate/docs/api.md` (Socket.IO events with payloads + error catalog)
- [x] `docs/games.md` (catalogue updated with Estimate row)
- [x] `docs/README.md` (repo overview with Estimate in the game table)
- [x] `docs/observability-metrics.md` (game_id + namespace list updated)
- [x] **Validation:** documentation synchronized with the implemented event/types contract
- [x] **Commit:** `docs(estimate): add game docs and platform catalogue updates` (`8139f4b`)

### Phase 9 — Final pass and follow-up fixes

- [x] Host identity synchronization uses one mutated `GameRoomLike` adapter
- [x] `phaseChange` is emitted alongside `roomUpdate`
- [x] Disconnects re-evaluate the all-connected-players condition
- [x] Final `ended` view renders the scoreboard and platform overlay
- [x] Full validation chain and remote SHA verification

### Phase 10 — Review-driven hardening (audit 2026-08-10)

Goal: close every confirmed backend, wire-contract, UI/UX, accessibility,
test, CI, dependency, documentation and generated-artifact finding from the
full branch review before merge.

#### 10.1 Domain integrity and deterministic rounds

- [x] Keep partial guesses and their derived display range private until
      `allSubmitted`; add wire-level regressions.
- [x] Score mathematically symmetric decimal guesses as ties using a documented
      floating-point tolerance.
- [x] Require `MIN_PLAYERS` connected players in both server and UI.
- [x] Draw a no-repeat question deck per match and reset it on restart.
- [x] Match the documented range algorithm exactly and pin exact range fixtures.

#### 10.2 Socket authority, lifecycle and observability

- [x] Enforce one socket ↔ one player slot in both rebinding directions and use
      the socket index for O(1) disconnect lookup.
- [x] Support real handshake-auth fallback for optional join payload fields.
- [x] Add bounded all-disconnected room cleanup independent of party cleanup.
- [x] Classify expected rejections separately from unexpected failures, expose
      only sanitized unexpected errors and emit structured lifecycle logs.
- [x] Add focused socket regressions for rebind, auth-only join, fallback host,
      cleanup, metrics outcome and connected-player start rejection.

#### 10.3 Resilient and accessible game UI

- [x] Model transport, join-pending, room-ready and recoverable-error states with
      timeout/retry and visible action errors/pending states.
- [x] Drive host controls from the authoritative `RoomView`, not the platform hint.
- [x] Remove the unimplemented timer contract and show disconnected-player lobby
      status without auto-submission.
- [x] Add semantic landmarks/headings, live announcements, focus management and
      programmatic form-error associations.
- [x] Make NumberLine responsive at 12 players, localized and accessible with a
      textual equivalent; remove fixed-height/hover-only assumptions.
- [x] Align layout, Estimate accent usage, contrast and mobile spacing with the
      shared design system.

#### 10.4 Platform lifecycle and regression coverage

- [x] Emit the canonical terminal phase `ended` and use the accessible shared
      platform overlay without hiding the readable final scoreboard.
- [x] Cover complete replay and return-to-party callbacks, unique next question,
      game-namespace host transfer and mobile UI in tests.
- [x] Replace the self-referential home-library expectation with an independent
      six-game contract.

#### 10.5 Production, dependencies, docs and generated artifacts

- [x] Run the production build in PR CI and assert the copied Estimate CSV path.
- [x] Remove branch-external major upgrades, reconcile workspace versions and
      make the high-severity dependency audit green without changing deferred majors.
- [x] Reconcile `CLAUDE.md`, platform/game docs, API/state contracts, player
      limits, load timing, observability names and this plan.
- [x] Bring all changed files through Prettier and refresh Graphify after the
      final code change.

#### 10.6 Final checkpoint

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm test` and `pnpm test:estimate`
- [x] `pnpm build` plus production `/health` smoke
- [x] `pnpm test:e2e`
- [x] `pnpm audit --audit-level=high`
- [x] Clean worktree after commit; local HEAD equals
      `origin/feat/estimate-game`

---

## 4. File Manifest (reference)

### 4.1 New files

```
games/estimate/package.json
games/estimate/core/src/types.ts
games/estimate/core/src/constants.ts
games/estimate/core/src/events.ts
games/estimate/core/src/range.ts
games/estimate/server/src/index.ts
games/estimate/server/src/socketHandlers.ts
games/estimate/server/src/models/room.ts
games/estimate/server/src/models/player.ts
games/estimate/server/src/managers/roundManager.ts
games/estimate/server/src/managers/scoreManager.ts
games/estimate/server/src/managers/broadcastManager.ts
games/estimate/server/src/utils/questionLibrary.ts
games/estimate/server/data/questions.csv
games/estimate/ui-vue/tsconfig.json
games/estimate/ui-vue/env.d.ts
games/estimate/ui-vue/src/App.vue
games/estimate/ui-vue/src/PlatformAdapter.vue
games/estimate/ui-vue/src/composables/useSocket.ts
games/estimate/ui-vue/src/stores/game.ts
games/estimate/ui-vue/src/components/Lobby.vue
games/estimate/ui-vue/src/components/QuestionView.vue
games/estimate/ui-vue/src/components/WaitingView.vue
games/estimate/ui-vue/src/components/NumberLine.vue
games/estimate/ui-vue/src/components/RevealView.vue
games/estimate/ui-vue/src/components/GameOver.vue
games/estimate/__tests__/questionLibrary.test.ts
games/estimate/__tests__/roundManager.test.ts
games/estimate/__tests__/scoreManager.test.ts
games/estimate/__tests__/socketHandlers.test.ts
games/estimate/e2e/game.spec.ts
games/estimate/docs/api.md
games/estimate/docs/architecture.md
games/estimate/README.md
```

### 4.2 Modified files (registry / wiring / docs)

```
apps/platform/server/registry/index.ts
apps/platform/src/games/index.ts
apps/platform/vite.config.ts
apps/platform/env.d.ts
apps/platform/src/styles/main.css
vitest.projects.ts
package.json
Dockerfile
docs/games.md                  (new)
docs/README.md                 (new)
```

## 5. Server Contract (Socket.IO)

**Namespace:** `/g/estimate`

### 5.1 Client → Server

| Event            | Payload                                               | Auth                           | Notes                                             |
| ---------------- | ----------------------------------------------------- | ------------------------------ | ------------------------------------------------- |
| `autoJoinRoom`   | `{ sessionId, name, playerId?, isHost?, joinToken? }` | `authorizePartyJoin`           | Mirrors scout. `isHost` is UI hint only.          |
| `submitGuess`    | `{ roomCode, playerId, guess: number }`               | socket-bound + room check      | `guess` must be a finite number; clamp to ±1e9.   |
| `revealSolution` | `{ roomCode, playerId }`                              | host-only (re-sync from party) | Server re-syncs host via `syncRoomHostAfterJoin`. |
| `nextRound`      | `{ roomCode, playerId }`                              | host-only                      | Advances to next question or ends the game.       |
| `restartGame`    | `{ roomCode, playerId }`                              | host-only                      | Resets scores, re-uses the same room.             |

### 5.2 Server → Client

| Event         | Payload               | Notes                                                            |
| ------------- | --------------------- | ---------------------------------------------------------------- |
| `roomUpdate`  | `RoomView`            | Single source of truth. Never includes `resumeToken`.            |
| `phaseChange` | `{ phase: Phase }`    | `'lobby' \| 'guessing' \| 'allSubmitted' \| 'reveal' \| 'ended'` |
| `error`       | `{ message: string }` | Client-displayed errors.                                         |

### 5.3 `RoomView` shape

```ts
interface RoomView {
  roomCode: string;
  phase: 'lobby' | 'guessing' | 'allSubmitted' | 'reveal' | 'ended';
  currentRound: number; // 1-indexed; 0 in lobby
  totalRounds: number;
  question: { id: string; text: string } | null; // answer hidden until reveal
  players: PlayerView[]; // hide disconnected except for self
  guesses: { playerId: string; guess: number }[]; // empty before submit
  solution: number | null; // null until host reveals
  winners: { playerId: string; name: string }[]; // empty until reveal; ties allowed
  scores: { playerId: string; name: string; points: number }[];
  displayRange: { lo: number; hi: number } | null; // null in lobby
}
```

`PlayerView`: `{ id, name, isHost, connected, hasSubmitted: boolean }`.
Server **never** broadcasts `resumeToken`, `joinToken`, raw auth strings, or
the answer before reveal.

## 6. State Machine

```
[lobby]  --host: startGame-->  [guessing]
[guessing]  --all connected players submitted-->  [allSubmitted]
[allSubmitted]  --host: revealSolution-->  [reveal]
[reveal]  --host: nextRound-->  [guessing] | [ended]
[ended]  --host: restartGame--> [lobby]
```

- Server is authoritative for phase transitions.
- `submitGuess` is idempotent (last-write-wins within a round) — useful
  if a player changes their mind.
- A disconnecting player keeps their last guess; on reconnect they
  re-enter `guessing` and may resubmit.
- When all **connected** players have `hasSubmitted: true`, server
  auto-transitions to `allSubmitted` and emits `phaseChange` alongside the
  `roomUpdate`. A disconnect re-evaluates this condition.
- Estimate has no countdown or automatic submission. The waiting state remains until every
  connected player submits or disconnects.

## 7. UI / UX

| Phase                     | Component          | Action affordances                                   |
| ------------------------- | ------------------ | ---------------------------------------------------- |
| `lobby`                   | `Lobby.vue`        | Host: "Spiel starten" (disabled until ≥ MIN_PLAYERS) |
| `guessing`                | `QuestionView.vue` | Player: numeric input + "Schätzung abgeben"          |
| `guessing`                | `WaitingView.vue`  | Player: "Warte auf N Spieler…"                       |
| `allSubmitted` / `reveal` | `RevealView.vue`   | NumberLine; Host: "Auflösen" / "Nächste Frage"       |
| `ended`                   | `GameOver.vue`     | Platform overlay: Play Again / Back to Party         |

### Number line (`NumberLine.vue`)

- Responsive CSS line derived from `lo`/`hi` in `RoomView.displayRange`.
- One always-labelled marker per player. A `ResizeObserver` assigns collision-free lanes from
  the available pixel width; a visually-hidden table provides the same data to screen readers.
- Distinct styling: player markers = round, game-accent colour; solution
  marker = square, gold/white outline. Solution marker renders only in
  `reveal` and later phases.
- Auto-scaling helper `computeDisplayRange(guesses, solution)` lives in
  `core/src/range.ts` and is shared via `@shared/range` so server
  pre-computation and client re-render never drift.

### Input handling

- `<input type="number" inputmode="decimal" />` for sane mobile keyboards.
- Client-side `parseFiniteNumber` helper (mirrors server's parser).
- Submit button disabled while input is empty or invalid; server
  validation is the source of truth.

## 8. Styling

- Game accent: **teal-blue** (`#0ea5e9` base), added to `main.css @theme`:
  ```css
  --color-estimate: #0ea5e9;
  --color-estimate-hover: #0284c7;
  --color-estimate-muted: rgba(14, 165, 233, 0.12);
  ```
- Tailwind v4 picks up the global `@source` glob already in `main.css`
  (`games/*/ui-vue/src/**/*.{vue,ts}`) — no per-game `@source` needed.
- Shared component classes: `ui-panel`, `ui-btn-primary`,
  `ui-btn-secondary`, `ui-input`, `ui-badge`, `ui-progress-track`,
  `ui-progress-fill`. No game-specific `@apply` — prefer scoped `<style>`
  blocks per `adding-a-new-game.md`.

## 9. Tests

### 9.1 Unit (Vitest)

- `questionLibrary.test.ts` — bundled CSV loads; blank/`#`/header skipped;
  fallback to `DEFAULT_QUESTIONS`; rejects NaN/Infinity/empty rows.
- `roundManager.test.ts` — start round → `guessing`; all-submitted →
  `reveal`; winner = smallest `|guess − answer|`; ties all winners;
  `nextRound` advances or ends; `restartGame` zeroes scores.
- `scoreManager.test.ts` — empty guesses → no winners; single guess →
  that player; tie → all tied players.
- `socketHandlers.test.ts` — `autoJoinRoom` rejects missing/invalid
  `joinToken`; host-only `revealSolution`/`nextRound` reject non-host;
  guess validation: NaN/Infinity/>1e9 → `{ ok: false, error: 'Invalid guess' }`.

### 9.2 E2E (Playwright)

The suite covers:

1. **Happy path:** two players submit, host reveals, and the number line is shown.
2. **Host is also a player:** host submits a guess like everyone else and can reveal.
3. **Tie resolution:** equal-distance guesses both appear as winners.
4. **Final game:** five rounds reach `ended`, showing the scoreboard and the
   platform replay / return-to-party overlay.

### 9.3 Validation gates

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:estimate
pnpm test:e2e
```

## 10. Observability & Logging

- `createComponentLogger('game-server', { gameId: 'estimate' })` and
  `createSocketLogger(...)` per connection — same as scout.
- Lifecycle logs: `room_created`, `player_joined`, `guess_submitted`,
  `round_revealed`, `round_winner(s)`, `next_round`, `game_ended`,
  `cleaned_up`.
- **Never log** `resumeToken`, `joinToken`, raw guess values. Log only
  `playerId`, `roomCode`, round index, and `|guess − answer|` (the
  distance) for the winner — to prevent a log reader from reconstructing
  the answer.

## 11. Documentation Updates (in this same slice)

- `games/estimate/README.md` — game overview.
- `games/estimate/docs/api.md` — Socket.IO reference.
- `games/estimate/docs/architecture.md` — phases, state machine, decisions.
- `docs/games.md` (new) — user-facing game catalog (one paragraph per
  game from `clientGameRegistry` metadata).
- `docs/README.md` (new) — index for `docs/`.
- `docs/known-issues.md` — append only if any deferred behaviour ships.

## 12. Risks & Edge Cases

| Risk                                                 | Mitigation                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "Auto-Scaling" interpreted as "auto-submit on timer" | Server never auto-submits and Estimate has no countdown. Documented in §1, §6.             |
| Decimal commas (DE locale) break CSV parse           | CSV uses dot decimal; server normalises. UI input restricts to `.` and digits.             |
| All players guess the same exact value               | Display range falls back to `answer ± 1` so the bar stays readable. Covered in unit tests. |
| Solution outside min/max of guesses                  | Server extends the range so the solution marker is always visible. §1, §7.                 |
| Game ends with all players tied                      | All tied players are winners; scoreboard shows all names. Test covers it.                  |
| Lockfile drift (new workspace package)               | `pnpm install` after Phase 0; commit updated `pnpm-lock.yaml` if it changes.               |

## 13. Out of Scope (Phase 2 candidates)

- Per-room question packs / runtime CSV upload (needs admin UI + storage).
- Per-question unit display ("km/h", "Jahr", "Meter") — would add a
  third `unit` column to the CSV.
- Audio cues on reveal.
- Persisted leaderboard across sessions (no platform-wide stats yet).

## 14. Summary

- Reuses every existing pattern (scout/flip7/imposter): same
  `authorizePartyJoin`, same Pinia shape, same PlatformAdapter replay
  overlay, same `sharedAliasPlugin`, same Vitest project, same E2E
  pattern, same Dockerfile manifest layer.
- Data lives in the game folder (`games/estimate/server/data/questions.csv`)
  like imposter's word library. No DB, no admin UI, no migrations.
- Host plays normally — no special "configure question" screen (per
  Jona 2026-07-27: UI auto-scales from players' guesses).
- No new platform infrastructure — pure leaf node, like the existing six.
- Phased commits with mid-slice push keep the branch reviewable at every
  step; nothing ships without a green `pnpm test:estimate`.
