# Codebase Review — 2026-09-26

Base: `535443c` (branch `claude/codebase-review-t2pr4b`). This review changed no production code.

## 1. Executive summary

The codebase is healthy overall. The platform/game split is clear. Party authorization (`authorizePartyJoin`) is used consistently by all eight games. Payload validation is disciplined, and hidden game state is filtered per player on the server. All gates pass (lint, both typechecks, 595 unit tests, build, audit), and E2E passes with retries. The prior review's fixes (F-01…F-05) are present.

**No Critical or High issues were found.** The most important risks are:

- **Gameplay deadlocks after a disconnect:**
  - Imposter can get stuck in `discussion` permanently (reproduced).
  - Flip 7 has no handling for the current-turn player disconnecting.
- **Lifecycle and cleanup gaps:**
  - Some party exits skip `cleanupMatch`.
  - The Blackout and Flip 7 room sweeps reset their own timers, so they never fire.
- **Deployment and data:**
  - Blackout seed-content updates never reach production because the SQLite DB lives on a persistent volume and is seeded only when empty.
  - Every deploy silently discards all in-memory parties and matches.
- **Robustness:** a redundant game-level resume token can lock a player out of a match that the platform has already authorized them for.
- **Accessibility:** most modal overlays lack dialog semantics and focus management.

## 2. Scope and evidence

**Read:**
- Documentation: CLAUDE.md, AGENTS.md, README, docs/*, progress.md.
- CI, deploy workflow, Dockerfile, docker-compose, .dockerignore.
- The whole platform server: index, httpRoutes, env, admin, party/*, registry, logging/*, metrics/httpMetrics, observability/*.
- Platform client: stores/party, usePartySocket, useHomePartyActions, PartyView, GameView, router.
- Every game's socket handlers, with Imposter, Blackout, Flip 7 and Estimate read in depth.
- Every game's room models and broadcast/view builders.
- Imposter's word library, Blackout's database module, the Kritzelagent and Herd Mentality round managers.

**Commands run** (Node 22.22 locally; the repo declares `>=24`):

| Command                                                       | Result                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                              | ok                                                                                                                                                                                                                                                                 |
| `pnpm test`                                                   | 55 files / 595 tests pass                                                                                                                                                                                                                                          |
| `pnpm lint`                                                   | pass                                                                                                                                                                                                                                                               |
| `pnpm typecheck` / `pnpm typecheck:games`                     | pass / pass                                                                                                                                                                                                                                                        |
| `pnpm build`                                                  | pass                                                                                                                                                                                                                                                               |
| `pnpm audit --audit-level=high`                               | no known vulnerabilities                                                                                                                                                                                                                                           |
| `pnpm format:check`                                           | failed on `.mcp.json` and `AGENTS.md`, but only because the session's graft tooling modified those files locally. The committed versions are not implicated.                                                                                                        |
| `playwright test` (CI=true, preinstalled Chromium rev 1194 vs pinned 1243, 4 CPUs / 8 workers) | 64 passed, 2 flaky (the Kritzelagent and Herd Mentality long-match tests), both passing on retry                                                                                                                                                                  |
| Throwaway Vitest repro (deleted afterwards)                   | confirmed finding M1                                                                                                                                                                                                                                               |
| Production build served locally + Playwright screenshots      | home page renders at 375 px and 1280 px with no horizontal overflow; an unknown route renders an empty page                                                                                                                                                        |

**Not verified:**
- Docker build and runtime.
- The Hostinger/Traefik deployment.
- The detailed game rules of Scout and Secret Signals.
- Visual review of in-game screens beyond the E2E runs.

## 3. System overview

**Components:**
- One Node process runs Express (static SPA, `/health`, `/metrics`, `/api/admin/*`) and Socket.IO.
- `/party` owns the party lifecycle: create → join → select → launch → replay/return.
- Each game registers `/g/<id>`.
- All state is in-memory Maps. The only persistence is Blackout's read-only seed DB and Imposter's words file.

**Trust model:**
- The party `resumeToken` is the bearer credential. It is reused as the game `joinToken`.
- A game's `autoJoinRoom` validates it against `party.activeMatch`.
- Later game actions are authorized either by the socket→player index (Imposter, Blackout, Flip 7, Scout, Secret Signals) or by re-running `authorizePartyJoin` (Estimate, Herd Mentality, Kritzelagent).

**Boundaries:**
- Browser → Socket.IO: all payloads are untrusted and read through `readString`/`readFiniteNumber`.
- Admin HTTP uses a JWT cookie plus a double-submit CSRF token.
- Traefik → app: `X-Forwarded-For` is trusted for exactly one hop.

## 4. Findings summary

| ID  | Sev    | Conf   | Category          | Location                                                                         | Finding                                                                                                     |
| --- | ------ | ------ | ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| M1  | Medium | High   | Correctness       | `games/imposter/server/src/handlers/socketHandlers.ts:119-141`, `gameManager.ts:167-186,349-360` | A disconnect or leave that completes the description phase never arms the discussion timer, so the room stays in `discussion` forever |
| M2  | Medium | High   | Correctness       | `games/flip7/server/src/managers/roundManager.ts`, `socketHandlers.ts:582-634`  | Flip 7 does not skip a disconnected current-turn player or pending action target, so the round stalls        |
| M3  | Medium | High   | Data / deploy     | `games/blackout/server/src/db/database.ts:255-270`, `docker-compose.yml`, `copy-db-assets.mjs` | Blackout seed CSV changes never reach production (seeded only when empty, DB on a persistent volume)          |
| M4  | Medium | High   | Security / abuse  | `games/imposter/server/src/utils/wordLibrary.ts:91-119`, `socketHandlers.ts:592-621` | Any player can permanently fill the shared global word pool (no rate limit, 2000 cap, newline injection)    |
| M5  | Medium | Medium | Reliability       | all 8 games' `autoJoinRoom` ("Resume token required")                              | The redundant game-level resume token can permanently lock an authorized player out of a match              |
| M6  | Medium | High   | Architecture / ops | in-memory stores + `deploy.yml` (deploys on every main push)                     | Every deploy drops all parties and matches without notice; the docs imply multi-instance support that cannot work |
| M7  | Medium | High   | Accessibility     | `GameView.vue:209-224`, 5 `PlatformAdapter.vue`, Flip 7 `ActionTargetPicker`, Scout `ScoutDialog`, `AdminView` | Modal overlays lack `role="dialog"`/`aria-modal`, focus movement/trap and Escape handling               |
| L1  | Low    | High   | Lifecycle         | `partyHandlers.ts:488-530`; `games/{blackout,flip7}/server/src/models/room.ts` sweeps | Leaving a party mid-match can orphan the game room, and the Blackout/Flip 7 backstop sweeps never fire   |
| L2  | Low    | High   | UX                | `usePartySocket.ts`, `useHomePartyActions.ts`, `PartyView.vue`                   | Platform flows have no connection-error state and no ack timeouts, so Create/Join can spin forever       |
| L3  | Low    | High   | Correctness       | `partyHandlers.ts:1062-1107`                                                     | `scheduleReturnCleanup` timers are untracked and can force a later "returning" state to lobby early        |
| L4  | Low    | High   | Security          | `games/{estimate,herd-mentality}` `broadcastRoom` + all `deleteRoom`             | Sockets are never removed from Socket.IO rooms when a game room is deleted, so a reused 4-char code can leak public state |
| L5  | Low    | Medium | Security          | `partyStore.ts:57-67`, `partyHandlers.ts` rate limit                              | Invite codes use `Math.random` (6×32 alphabet), and rate limits are per socket, not per IP               |
| L6  | Low    | High   | Correctness       | Imposter `kickPlayer`                                                            | An in-game lobby kick is ineffective: the kicked party member can immediately `autoJoinRoom` again         |
| L7  | Low    | High   | UX / design       | `partyHandlers.ts:1022-1027`                                                     | A brief host disconnect transfers host permanently; it is not restored when the host reconnects             |
| L8  | Low    | High   | Observability     | Flip 7 `hit`/`stay`/`chooseActionTarget`                                         | Expected rule rejections (e.g. not your turn) are logged at `error` and counted as failures               |
| L9  | Low    | High   | Testing / CI      | `playwright.config.ts`, `ci.yml`                                                 | E2E runs against the Vite dev server rather than the production build; `retries: 2` hides flakiness; no `format:check` in CI |
| L10 | Low    | High   | UX                | `router/index.ts`                                                                | No catch-all route; unknown URLs render a blank page                                                        |
| N1  | Nit    | High   | Maintainability   | Estimate/Herd `codeByPlayer`, `getRoomByPlayerId`                                | Dead global player→room map, and it would be wrong across replays if ever used                              |
| N2  | Nit    | High   | Repo hygiene      | `games/blackout/server/src/db/blackout.sqlite`                                   | A tracked binary DB despite `.gitignore`, with the same seed-drift problem in dev                          |
| N3  | Nit    | High   | Deps              | `apps/platform/package.json`                                                     | Duplicate, divergent versions (`@types/node` ^22 vs ^24, `concurrently` ^9 vs ^10); runtime image installs client-only deps |
| N4  | Nit    | Medium | Privacy           | `admin.ts:424`, request logger                                                   | Failed-login usernames are logged; the `x-csrf-token` header is not in the redaction list                  |

## 5. Detailed findings

### M1 — Imposter room stuck in `discussion` after a disconnect ends the description phase

**Evidence:**
- `handleVoluntaryDisconnect` calls `syncDescriptionTurn`, which fills in `''` for a disconnected current describer and calls `advanceDescriptionTurn`. When no descriptions remain, that calls `startDiscussion`.
- The discussion timer and `discussionEndsAt` are only set inside the `submitDescription` and `skipDescriptionTurn` handlers (`socketHandlers.ts:693-706, 737-750`).
- `startVoting` is only reachable from those timers.

**Problem:** the disconnect and `leaveRoom` paths move the room into `discussion` with `discussionEndsAt = null` and no timer.

**Impact:** the round can never reach voting. The host's only escapes are `restartGame` (which loses scores) or ending the match through the platform.

**Reproduction (confirmed):** 3 players; the host starts; the first two describers submit; the last describer's socket disconnects. The phase is then `discussion`, `discussionEndsAt` is `null`, and advancing fake timers past the discussion duration leaves the phase at `discussion`.

**Recommendation:** move timer arming into one helper, e.g. `ensureDiscussionTimer(room)`. Call it after every state mutation that can enter `discussion`: submit, skip, disconnect and leave. The same applies when players reconnect after all players disconnected, because `clearRoomTimers` runs when the room empties and nothing re-arms the timer.

**Verification:** a handler-level test for the scenario above, plus an "all disconnect, then reconnect during discussion" test.

### M2 — Flip 7 turn stalls when the active player disconnects

**Evidence:** Flip 7's `roundManager.ts` never reads `player.connected`. The disconnect handler only reassigns host and schedules cleanup. The other turn-based games handle this case: Scout (`skipDisconnectedCurrentTurn`), Kritzelagent (`recheckAfterDisconnect`), Imposter (`syncDescriptionTurn`) and Blackout (reader reassignment).

**Impact:** if the current-turn player, or the player who must choose an action target, closes the tab or leaves the party, nobody can act until they return. If they left the party, they can never return.

**Recommendation:** add `handlePlayerDisconnected(room)`, mirroring Scout. It should auto-stay (or skip) a disconnected current player and auto-resolve or skip a pending action target. Optionally add a host "skip player" action.

**Verification:** a unit test in which the current player disconnects mid-round and the turn advances, plus a test in which a disconnected pending-target chooser is resolved.

### M3 — Blackout content updates never reach production

**Evidence:**
- The seed runs only when a table is empty (`database.ts:266-270`).
- Production sets `DB_PATH=/data/blackout/blackout.sqlite` on the `blackout-db` named volume.
- `copy-db-assets.mjs` deletes the DB in `dist/` "so the server re-seeds from the current CSVs". That has no effect when `DB_PATH` points at the volume.
- The DB is otherwise read-only: only `SELECT` statements exist in `categoryManager.ts`.

**Impact:** new, corrected or removed categories, tasks and excluded letters in the CSVs are silently ignored in production after the first deploy. Local development has the same problem via the tracked `blackout.sqlite` (N2).

**Recommendation:** the DB holds no user data, so rebuild it from the CSVs on every start. Use an in-memory DB, or a temp file with an atomic swap. Then drop the `blackout-db` volume and the `prepare-app-data` chown for it. The alternative is a content hash or version stored in a meta table that triggers a re-seed.

**Verification:** start once, change a CSV row, restart, and assert the new row is served.

### M4 — Shared Imposter word pool can be polluted or exhausted by any player

**Evidence:**
- `submitWord` has no rate limit; only `submitDescription` and `submitVote` use `gameplayRateLimit`.
- `persistWord` appends to a process-global, per-locale list that is persisted to the `imposter-words` volume and seeds every future room (`gameManager.ts:29`).
- Words are length-checked (≤ 40) but not character-checked, so an embedded `\n` writes multiple lines to the file.
- The library is capped at 2000 words; once full, legitimate submissions are dropped with only a server-side warning.

**Impact:** one scripted client in any lobby can permanently inject arbitrary (e.g. offensive) secret words into all future games and fill the library to its cap.

**Recommendation:**
- Rate-limit `submitWord`.
- Reject control characters.
- Keep player-submitted words room-scoped, or send them to a moderation/allow-list step, instead of persisting them globally by default. Consider flipping `IMPOSTER_PERSIST_WORDS` to opt-in.
- Store bundled words and submitted words separately so the cap applies only to submissions.

**Verification:** tests for newline rejection, rate-limit rejection, and bundled words being unaffected by the cap.

### M5 — The game-level resume token can lock out an authorized player

**Evidence:** every game's `autoJoinRoom` returns "Resume token required" or "Invalid resume token" when an existing room player reconnects without the matching token that was stored in `localStorage` (`<game>.session`). The platform `joinToken` has already authenticated that same member, so the second token adds no security.

**Impact:** the player is permanently unable to rejoin the running match (retries fail the same way) whenever:
- the autoJoin ack is lost (disconnect between server commit and client receipt);
- storage is cleared or unavailable;
- another tab of the same browser overwrote the per-game key.

**Recommendation:** once `authorizePartyJoin` succeeds, bind the existing player without requiring the game token. At minimum, key the stored session by `matchKey`.

**Verification:** a test in which an existing player autoJoins with a valid `joinToken` and no or stale game token, and is rebound.

### M6 — Deploys terminate all sessions; multi-instance support is implied but impossible

**Evidence:**
- Parties, matches, rooms and rate limits are module-level Maps.
- `deploy.yml` deploys every green `main` commit.
- On SIGTERM, `io.close()` runs immediately.
- Clients then get "Party not found" and are sent home with their session cleared.
- CLAUDE.md and docs/deployment.md describe `IMPOSTER_PERSIST_WORDS=false` "for multi-instance deployments". Multi-instance cannot work: there is no Socket.IO adapter, no sticky sessions, and no shared party store.

**Impact:** every merge ends all active games without warning. The documentation misleads operators about scaling.

**Recommendation:**
- Document single-instance as a hard constraint.
- Gate deploys (manual approval or a quiet-hours window), or add a drain step: stop new launches and wait for active matches up to a limit, then shut down.
- Show a "server restarted" message instead of silently returning users home.

### M7 — Modal overlays are not accessible dialogs

**Evidence:** 10 files use `.ui-dialog`. Only Estimate, Herd Mentality and Kritzelagent `PlatformAdapter` and one Secret Signals dialog declare `role="dialog"`. There is no Escape handling anywhere, and focus is not moved into or trapped within the platform leave dialog or most game overlays.

**Impact:**
- Screen-reader users are not told a modal opened.
- Keyboard users can tab behind the overlay into the obscured game UI.

This is a functional defect under WCAG 2.2 (2.4.3 Focus Order, 4.1.2 Name, Role, Value).

**Recommendation:** use one shared dialog component (native `<dialog>` with `showModal()`, or `role="dialog"` + `aria-modal` + labelled-by + focus trap + Escape + return focus), and use it for all overlays. The Herd Mentality game-over dialog, which E2E already tests for focus, is a good template.

### Low and Nit notes

- **L1:**
  - `leaveParty` calls `deleteParty` when the leaving host was the last connected member, or when no members remain. That path does not call `cleanupActiveMatchOnPartyExpire`, and `deleteParty` also clears the 2-hour match timeout.
  - Blackout's hourly sweep and Flip 7's 10-minute sweep call `scheduleRoomCleanup`, which clears and re-creates the timer on every pass. Blackout ended/idle rooms (60 min/24 h) and Flip 7 ended rooms (60 min) therefore never expire, and the Blackout sweep can also replace the 5-minute disconnect timer with a 24-hour one.
  - Scout already has the fix (`if (roomTimers.has(code)) continue;`).
- **L3:** the 10 s return-cleanup timeout checks only `status === 'returning'`. A second return within 10 s is finalized early by the first timer. Store the timer, or compare the match key.
- **L4:** call `nsp.in(code).socketsLeave(code)` in every `deleteRoom`.
- **L5:** use `crypto.randomInt`, and add a per-IP limiter on `joinParty`/`resumeParty`.
- **L9:** add a production-build smoke E2E (`pnpm start` + one full flow), add `format:check` to CI, and raise the timeouts of long E2E tests rather than relying on retries.

## 6. Architecture assessment

**Strengths:**
- A single owner for the lifecycle.
- A shared auth helper, payload readers, socket index, rate limiter and logging/metrics helpers, all actually reused.
- Server-side, per-viewer projection of hidden state in every game reviewed (Imposter, Secret Signals, Kritzelagent, Estimate, Herd Mentality).

**Weaknesses:**
- Eight hand-written variants of the same room lifecycle (join/rebind, host sync, cleanup sweep, disconnect-turn handling), which have drifted (L1, M2).
- Two different authorization models for post-join actions.

A small shared "room lifecycle" kit would remove most of this class of bugs: rebind, host sync, a cleanup scheduler that never re-arms an existing timer, and a disconnect hook contract. No rewrite is warranted.

## 7. Functional assessment

**Verified working:** create/join/resume, launch/replay/return, reload-resume in each game, host-only enforcement, and content locale per match (all covered by unit tests and E2E).

**Gaps:**
- Disconnect-driven stalls (M1, M2).
- Lifecycle leaks (L1).
- In-game kick is ineffective (L6).
- Known, documented rule deviation: Scout 2-player mode.

**Docs vs. code:**
- The multi-instance claim (M6).
- `playwright.config.ts` comment "tests will need updating" is stale.

## 8. Security and privacy

**Verified sound:**
- Join authorization.
- Host derived from party state.
- No `v-html` anywhere.
- CSP and security headers.
- Admin: bcrypt, JWT with 1 h expiry, SameSite=Strict cookies, CSRF double-submit, rate limits keyed on the correct `req.ip`.
- Metrics gated in production.
- Token/cookie log redaction.
- 64 KB Socket.IO message cap.
- Unchecked payload method calls: only one found, and it is guarded.

**Verified weaknesses:** M4, L4, L5, N4.

**Potential risk, not verified:**
- Clients that call the server directly without the proxy: XFF is trusted for 1 hop by default. That is correct behind Traefik and spoofable if the app is ever exposed directly.
- `resumeToken` doubles as `joinToken`, so any game module that mishandles it exposes party resume.

No hidden-state values were found in log statements.

## 9. Data and persistence

- **Blackout:** see M3 and N2.
- **Imposter words:** see M4. Writes use `appendFileSync` on the request path, which is acceptable at this volume.
- Everything else is ephemeral (M6).

## 10. Performance, scalability, reliability

At party-game scale there are no hot-path problems.

- `getPartyByActiveMatch` is O(parties) per join.
- `broadcastJoinableParties` rebuilds a full snapshot on every party mutation. This is fine now; add an index or debounce if parties reach the thousands.
- Kritzelagent resends all strokes on each broadcast, but that is bounded (≤ 24 strokes × 80 points).

The reliability issues are the stalls (M1, M2) and deploy resets (M6), not throughput.

## 11. UI / UX / accessibility

**Observed in the rendered page:**
- The home page renders correctly at 375 px and 1280 px with no horizontal overflow.
- Unknown routes are blank (L10).
- Google Fonts failed to load in the sandbox (proxy certificate), which is environmental.

**From source:**
- M7.
- L2.
- Server errors that include player names ("X is already the Director…", "Waiting for X…") bypass localization and show in English.

**Not visually verified:** in-game screens on phones beyond E2E, and the known Secret Signals header overlap.

## 12. Testing

**Strengths:**
- Handler-level tests with real party authorization.
- Invalid-payload tests.
- i18n parity tests.
- Reload/resume E2E for every game.

**Gaps (highest value first):**
1. M1 disconnect-into-discussion.
2. Flip 7 active-player disconnect.
3. Cleanup-sweep timer behaviour (use fake timers).
4. `leaveParty` mid-match cleanup.
5. Word-submission abuse.
6. A production-build E2E smoke test.

The unit tests mock `wordLibrary` entirely, so persistence behaviour is untested.

## 13. Maintainability and developer experience

- Documentation is thorough.
- The main debt is the duplicated per-game lifecycle code (section 6).
- Dependency hygiene: N3.
- The engine requirement is Node ≥ 24; running under 22 worked for all gates here.

## 14. Prioritized action plan

- **Fix first** (user-visible deadlocks and silent content drift; each is cheap):
  - M1
  - M2
  - M3
  - M4
- **Fix next:**
  - M5 (lockout robustness).
  - M6 (deploy policy and docs).
  - M7 (accessibility).
  - L1 (lifecycle leaks).
  - L2 (connection feedback).
- **Improve later:** the remaining L* and N* items, plus a shared room-lifecycle kit.

## 15. Positive findings

- Consistent use of `authorizePartyJoin` and payload readers.
- A per-viewer hidden-state model.
- Careful comments explaining security decisions (trust proxy, redaction, rate limits).
- Deploy freshness and serialization.
- A non-root runtime image.
- Structured, low-cardinality metrics.
- Strong i18n discipline.
- A broad and meaningful E2E suite.

## 16. Unverified areas and assumptions

- Docker image build and runtime behaviour, including volume ownership.
- Traefik hop count in production.
- Hosted CI and deploy.
- E2E with the pinned Chromium 1243 (1194 was used).
- Full rule correctness of Scout, Secret Signals and Flip 7 scoring.
- Whether Secret Signals stalls when a director disconnects (not traced).
- Node 24 runtime (Node 22 was used).
