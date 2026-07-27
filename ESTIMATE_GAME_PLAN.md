# Estimate Game — Implementation Plan

> **Status:** Plan, awaiting Jona's OK
> **Branch:** `pi/create-estimate-game` (from `main` @ `43af1a8`)
> **Author:** Hermes Agent
> **Date:** 2026-07-27
> **Game-ID:** `estimate`

---

## 1. Concept (Jona's Brief, distilled)

A new game in the **game-platform** repo. The host is just another player
(no special setup screen). The platform party flow is unchanged.

**Per round:**

1. Server broadcasts the current question (text only — e.g.
   *„In welchem Jahr fiel die Berliner Mauer?"*).
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
- [x] `games/estimate/server/src/config/constants.ts` (`IS_E2E`, `GUESS_TIMER_MS`)
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

> Phases 5 and 6 were rolled into Phase 4 because each Vue component is
> small and self-contained. The components implemented in this commit:
>
> - `Lobby.vue` — host-gated start button, player list, ready hint
> - `QuestionView.vue` — numeric input with decimal-comma normalization and
>   GUESS_VALUE_LIMIT guard mirroring the server-side validator
> - `WaitingView.vue` — counter for "X / Y submitted" before host reveals
> - `RevealView.vue` — NumberLine + solution banner + host-only reveal/next
>   buttons. Emits the same `reveal` and `next` events the parent forwards.
> - `GameOver.vue` — final scoreboard sorted by points
> - `NumberLine.vue` — SVG-less CSS-line with stacked player markers
>   (collision-avoidance), gold solution marker (only post-reveal), auto-
>   scaled range from the RoomView's `displayRange`
- [ ] **Validation:** `pnpm dev` (manual: connect/disconnect smoke)
- [ ] **Commit:** `feat(estimate): ui shell and socket`

### Phase 5 — Lobby + guessing UI
- [ ] `games/estimate/ui-vue/src/components/Lobby.vue`
- [ ] `games/estimate/ui-vue/src/components/QuestionView.vue`
- [ ] `games/estimate/ui-vue/src/components/WaitingView.vue`
- [ ] **Validation:** manual smoke + screenshot review
- [ ] **Commit:** `feat(estimate): lobby and guessing ui`

### Phase 6 — Reveal + game-over UI
- [ ] `games/estimate/ui-vue/src/components/NumberLine.vue` (SVG, player markers + solution marker)
- [ ] `games/estimate/ui-vue/src/components/RevealView.vue`
- [ ] `games/estimate/ui-vue/src/components/GameOver.vue`
- [ ] **Validation:** manual smoke (host reveals, all see markers) + mobile viewport
- [ ] **Commit:** `feat(estimate): reveal and gameover ui`

### Phase 7 — E2E
- [ ] `games/estimate/e2e/game.spec.ts` (happy path, host-is-player, tie)
- [ ] **Validation:** `pnpm test:e2e` (full)
- [ ] **Commit:** `test(estimate): e2e happy path and tie`

### Phase 8 — Docs
- [x] `games/estimate/README.md` (user guide + dev commands + adding questions)
- [x] `games/estimate/docs/architecture.md` (phase machine, modules, host-gating, first-join fix)
- [x] `games/estimate/docs/api.md` (Socket.IO events with payloads + error catalog)
- [x] `docs/games.md` (catalogue updated with Estimate row)
- [x] `docs/README.md` (repo overview with Estimate in the game table)
- [x] `docs/observability-metrics.md` (game_id + namespace list updated)
- [ ] `docs/README.md` (index for `docs/`)
- [ ] **Validation:** `pnpm format:check` + `pnpm lint`
- [ ] **Commit:** `docs(estimate): game docs`

### Phase 9 — Final pass
- [ ] Regenerate graphify graph (`~/.local/bin/graphify update .`)
- [ ] Full validation chain: `pnpm test && pnpm test:e2e && pnpm lint && pnpm typecheck && pnpm format:check && pnpm build`
- [ ] Update `PROGRESS.md` / validation log if present
- [ ] Verify `HEAD == origin/pi/create-estimate-game`
- [ ] **Commit:** `chore(estimate): graphify and final validation`

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
games/estimate/server/src/config/constants.ts
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
| Event             | Payload                                                  | Auth                              | Notes |
| ----------------- | -------------------------------------------------------- | --------------------------------- | ----- |
| `autoJoinRoom`    | `{ sessionId, name, playerId?, isHost?, joinToken? }`    | `authorizePartyJoin`              | Mirrors scout. `isHost` is UI hint only. |
| `submitGuess`     | `{ roomCode, playerId, guess: number }`                  | socket-bound + room check         | `guess` must be a finite number; clamp to ±1e9. |
| `revealSolution`  | `{ roomCode, playerId }`                                 | host-only (re-sync from party)    | Server re-syncs host via `syncRoomHostAfterJoin`. |
| `nextRound`       | `{ roomCode, playerId }`                                 | host-only                         | Advances to next question or ends the game. |
| `restartGame`     | `{ roomCode, playerId }`                                 | host-only                         | Resets scores, re-uses the same room. |

### 5.2 Server → Client
| Event         | Payload                          | Notes |
| ------------- | -------------------------------- | ----- |
| `roomUpdate`  | `RoomView`                       | Single source of truth. Never includes `resumeToken`. |
| `phaseChange` | `{ phase: Phase }`               | `'lobby' \| 'guessing' \| 'reveal' \| 'roundEnd' \| 'gameEnd'` |
| `error`       | `{ message: string }`            | Client-displayed errors. |

### 5.3 `RoomView` shape
```ts
interface RoomView {
  roomCode: string;
  phase: 'lobby' | 'guessing' | 'reveal' | 'roundEnd' | 'gameEnd';
  currentRound: number;          // 1-indexed; 0 in lobby
  totalRounds: number;
  question: { id: string; text: string } | null; // answer hidden until reveal
  players: PlayerView[];          // hide disconnected except for self
  guesses: { playerId: string; guess: number }[]; // empty before submit
  solution: number | null;        // null until host reveals
  winners: { playerId: string; name: string }[];   // empty until reveal; ties allowed
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
[guessing]  --all submitted-->  [reveal]    (auto-transition, server-driven)
[reveal]  --host: nextRound-->  [guessing] | [gameEnd]   (if last round)
[reveal]  --host: restartGame--> [lobby]    (optional, only after gameEnd)
```

- Server is authoritative for phase transitions.
- `submitGuess` is idempotent (last-write-wins within a round) — useful
  if a player changes their mind.
- A disconnecting player keeps their last guess; on reconnect they
  re-enter `guessing` and may resubmit.
- When all **connected** players have `hasSubmitted: true`, server
  auto-transitions to `reveal` and freezes `guesses`.
- A 60-second soft timer (`GUESS_TIMER_MS = IS_E2E ? 2_000 : 60_000`)
  prompts un-submitted players via a UI badge. **The server never
  auto-submits** on a player's behalf — the timer is UI-only.

## 7. UI / UX

| Phase        | Component            | Action affordances                                  |
| ------------ | -------------------- | --------------------------------------------------- |
| `lobby`      | `Lobby.vue`          | Host: "Spiel starten" (disabled until ≥ MIN_PLAYERS)|
| `guessing`   | `QuestionView.vue`   | Player: numeric input + "Schätzung abgeben"         |
| `guessing`   | `WaitingView.vue`    | Player: "Warte auf N Spieler…"                      |
| `reveal`     | `RevealView.vue`     | `NumberLine.vue` with markers; Host: "Auflösen" / "Nächste Frage" |
| `gameEnd`    | `GameOver.vue`       | Platform overlay: Play Again / Back to Party        |

### Number line (`NumberLine.vue`)
- Horizontal SVG, `viewBox` derived from `lo`/`hi` in `RoomView.displayRange`.
- One labelled marker per player, stacked above the line at their guess
  position. Player name + exact value on hover/tap.
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
Mirrors `games/scout/e2e/game.spec.ts`. Required scenarios:
1. **Happy path:** 4 players → all submit → host reveals → next round →
   all submit → host reveals → final scoreboard.
2. **Host is also a player:** host submits a guess like everyone else,
   appears as a marker on the number line, can reveal for the whole room.
3. **Tie resolution:** two players at equal distance → both +1 in scoreboard.

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

| Risk                                                                                              | Mitigation                                                                                          |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "Auto-Scaling" interpreted as "auto-submit on timer"                                               | Server never auto-submits. Timer is UI-only. Documented in §1, §6.                                  |
| Decimal commas (DE locale) break CSV parse                                                        | CSV uses dot decimal; server normalises. UI input restricts to `.` and digits.                      |
| All players guess the same exact value                                                            | Display range falls back to `answer ± 1` so the bar stays readable. Covered in unit tests.          |
| Solution outside min/max of guesses                                                               | Server extends the range so the solution marker is always visible. §1, §7.                          |
| Game ends with all players tied                                                                   | All tied players are winners; scoreboard shows all names. Test covers it.                           |
| Lockfile drift (new workspace package)                                                            | `pnpm install` after Phase 0; commit updated `pnpm-lock.yaml` if it changes.                        |

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
- No new platform infrastructure — pure leaf node, like the existing five.
- Phased commits with mid-slice push keep the branch reviewable at every
  step; nothing ships without a green `pnpm test:estimate`.
