# Herd Mentality – Implementation Plan

Status: Bounded implementation and hardening complete; manual screen-reader and production-browser smoke remain unavailable
Branch: `feat/herd-mentality`
Base: `feat/estimate-game` at `e71727d3502e2b66a2f708d3e0c7ebb24caacc09`

## Product decision

Build an original, German-first party game inspired by the majority-answer
mechanic researched for Herd Mentality. The implementation must not copy the
commercial title's artwork, wording, prompt text, or branding. Working game ID:
`herd-mentality`.

### MVP rules

- 4–20 players; the host is also a normal participant.
- The host starts the match once at least four currently connected players are
  present. There is no host-only configuration screen.
- Each round presents one original question prompt. Every eligible connected
  player submits one private free-text answer simultaneously.
- During `answering`, clients receive only `hasSubmitted` flags. Raw answers,
  answer groups, and derived counts stay server-private until the reveal.
- At reveal, answers are grouped by deterministic normalization only:
  Unicode NFKC, trim, collapse whitespace, and locale-independent lowercase.
  Synonyms, punctuation equivalence, and semantic equivalence are explicitly
  out of scope for the first slice.
- Every answer group with at least two players earns one cow per member.
- If exactly one player is the sole unmatched answer while another group has at
  least two players, that player receives the pink cow. If there are multiple
  unmatched answers, no new pink cow is assigned.
- The pink cow transfers only when a new sole unmatched answer is produced.
  A player holding the pink cow cannot win, even with eight cows.
- The first player with at least eight cows and no pink cow wins immediately at
  reveal. Otherwise the host advances to the next round.
- Empty answers, answers longer than the declared limit, malformed payloads,
  duplicate submissions, and actions from the wrong phase are rejected without
  mutating room state.
- Disconnects do not block completion: the required quorum is recalculated from
  eligible players who are currently connected. A valid reconnect can reclaim a
  slot before reveal using the normal platform resume flow.

## Research basis

- [Big Potato Games – Herd Mentality](https://bigpotato.com/products/herd-mentality)
  confirms the core majority-answer loop, pink-cow penalty, 4–20 players, and
  approximately 20-minute duration.
- The platform's existing modules confirm the internal `core`/`server`/`ui-vue`
  layout, Socket.IO namespaces, platform authorization, resume tokens, and
  `PlatformAdapter.vue` replay/return contract.
- The contribution contract in `docs/adding-a-new-game.md` is authoritative for
  the integration and validation checklist.

## Architecture decisions

- **State machine:** `lobby → answering → reveal → answering`; successful
  target score transitions to `ended`; replay is handled by the platform.
- **Server authority:** room state, answer acceptance, grouping, score deltas,
  target-score detection, host checks, connection quorum, and all phase
  transitions are server-owned.
- **Content:** original German prompts in
  `games/herd-mentality/server/data/prompts.csv`, loaded once with a tested
  file-reader injection and a built-in fallback. No database, admin UI, or hot
  reload in the first slice.
- **Privacy:** public room views redact submitted answer text and all group
  information during `answering`; reveal views may expose the resolved answer
  groups. No `resumeToken`, join token, or private payload is broadcast or
  logged.
- **Identity:** every `autoJoinRoom` validates `unknown` input, calls
  `authorizePartyJoin`, binds the authorized player ID on first join, validates
  resume tokens on rejoin, and calls `syncRoomHostAfterJoin`. Client
  `isHost` is only a UI hint.
- **Observability:** use shared component/socket loggers, per-handler
  instrumentation, and namespace connection metrics. Log lifecycle outcomes
  without raw answers or secrets.
- **UI:** Vue 3 `<script setup lang="ts">`, typed props/emits, Pinia setup store,
  shared platform classes/design tokens, native form controls, visible labels,
  focus-visible states, live-region phase announcements, and mobile-first
  responsive layout. No color-only scoring indicator.
- **Testing:** pure normalization/grouping/scoring tests first; server handler
  authorization/privacy/quorum tests next; platform-flow Playwright tests last.
  E2E uses role/label/test-id locators and state-transition assertions rather
  than arbitrary sleeps.

## Phase checklist

### Phase 0 – Plan and branch

- [x] Confirm the current `feat/estimate-game` worktree is clean.
- [x] Verify local Estimate HEAD equals `origin/feat/estimate-game`.
- [x] Create `feat/herd-mentality` from the verified Estimate HEAD.
- [x] Push the new branch and verify local SHA equals the remote branch SHA.
- [x] Commit this plan before implementation code.

### Phase 1 – Scaffold and platform wiring

- [x] Create `games/herd-mentality/package.json` as a private CommonJS
      workspace package.
- [x] Add core contracts: `constants.ts`, `types.ts`, and `events.ts`.
- [x] Add server/UI directory structure and strict UI TypeScript config.
- [x] Add server `index.ts` exports for `definition`, `register`, and
      `cleanupMatch`.
- [x] Add the game to the server registry and client registry.
- [x] Add both Vite changes: `@herd-mentality-ui` alias and the
      `sharedAliasPlugin()` branch.
- [x] Add the platform Vue module declaration and Herd accent tokens.
- [x] Add the Vitest project, root `test:herd-mentality` script, and Docker
      manifest-layer `COPY` entry.
- [x] Run `pnpm install --lockfile-only` and `pnpm typecheck` after the workspace scaffold.

### Phase 2 – Core rules and prompt library

- [x] Implement deterministic answer normalization with explicit length and
      empty-input boundaries.
- [x] Implement answer grouping, cow allocation, pink-cow transfer, and winner
      detection as pure functions.
- [x] Implement prompt CSV loading, validation, caching, fallback data, and the
      test file-reader injection pattern.
- [x] Add focused Vitest coverage for normalization, duplicate groups,
      multiple unmatched answers, pink-cow transfer/retention, winning with and
      without the pink cow, prompt parsing, invalid rows, and boundary values.

### Phase 3 – Authoritative server

- [x] Implement `Player`, `Room`, round state, and indexed socket/session
      ownership following the current game patterns.
- [x] Implement `roundManager`, `scoreManager`, and `broadcastManager` with
      phase-safe public views.
- [x] Implement `autoJoinRoom`, reconnect/resume, `startGame`,
      `submitAnswer`, `nextRound`, `requestState`, and disconnect handling.
- [x] Ensure all callback-bearing handlers use
      `startSocketHandlerInstrumentation`; no-callback events use a no-op ack.
- [x] Add shared logger and namespace connection/disconnect instrumentation.
- [x] Test negative authorization and phase cases, hidden answer privacy after
      one submission, connected-player quorum, duplicate submissions, host-only
      transitions, one-socket rebinding, and cleanup by `matchKey`.

### Phase 4 – Vue game client

- [x] Implement `useSocket` with `joinToken` in handshake auth and guaranteed
      disconnect on unmount.
- [x] Implement the Pinia game store with typed room updates, action errors,
      reconnect state, and session persistence.
- [x] Implement `App.vue` and `PlatformAdapter.vue`, including `phase-change`
      with `ended` and the platform replay/return overlay.
- [x] Implement focused components for lobby, question/answer entry, waiting,
      reveal/group results, scoreboard, and game-over state.
- [x] Add accessible labels, `aria-invalid`/`aria-describedby` errors,
      phase-live regions, keyboard operation, focus management, 44px touch targets,
      reduced-motion handling, and no horizontal overflow at 320px/200% text size.

### Phase 5 – Full-flow E2E

- [x] Add `games/herd-mentality/e2e/game.spec.ts` using separate platform
      browser contexts and stable role/label/test-id locators.
- [x] Cover the platform flow with four players: create party, join, launch, start,
      simultaneous answers, reveal, score, and next round.
- [x] Verify that answer text and group counts are absent from every client
      before reveal, including after the first submission.
- [x] Verify invalid/duplicate submissions do not advance the phase and expose
      an accessible error.
- [x] Verify pink-cow behavior, winner blocking while pink cow is held, final
      scoreboard, replay, and return-to-party overlay.
- [x] Verify reconnect during an active round and disconnect quorum behavior.
- [x] Verify mobile layout, 200% text size, focus order, and document-level
      horizontal overflow.

### Phase 6 – Documentation and catalogue

- [x] Add `games/herd-mentality/README.md` with original rules, limits, prompt
      data policy, and platform-only runtime instructions.
- [x] Add `games/herd-mentality/docs/api.md` with exact Socket.IO payloads,
      acknowledgements, privacy boundaries, and errors.
- [x] Add `games/herd-mentality/docs/architecture.md` with state machine,
      ownership, scoring decisions, lifecycle logs, and cleanup behavior.
- [x] Update `docs/games.md` and `docs/README.md` with the user-facing entry.
- [x] Update the root README's stale game-count/test comments while preserving
      historical statements as historical where applicable.
- [x] Reconcile this plan's checklist and validation results in the same
      commits as the corresponding implementation slices.

### Phase 7 – Release gates and checkpoint

- [x] Run focused tests: `pnpm test:herd-mentality`.
- [x] Run complete gates: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
      `pnpm test`, and `pnpm build`.
- [x] Verify the built prompt asset is present and non-empty at its compiled
      server path.
- [x] Run `pnpm test:e2e` and separate production HTTP smoke checks. Production
      browser smoke is verified separately against port 3000.
- [x] Run `pnpm audit --audit-level=high`: no known vulnerabilities found after
      pinning transitive `qs` to the published patched `6.16.0` release.
- [x] Run the bounded wiring/docs/privacy/accessibility audit with automated
      browser evidence; manual screen-reader verification remains unavailable.
- [x] Commit the completed slice, push, and verify
      `git log -1 --format=%H` equals `git ls-remote origin
refs/heads/feat/herd-mentality`.
- [x] Verify a clean worktree and that the branch remains based on the chosen
      Estimate base.
- [x] Re-run `pnpm install --frozen-lockfile` and the complete local gate chain
      after the dependency override.

## Validation record

- `pnpm test:herd-mentality` — passed.
- `pnpm test` — 45 test files / 408 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` and `git diff --check` — passed.
- `pnpm build` — passed; compiled `prompts.csv` is present and non-empty.
- `pnpm test:e2e` — 63 tests passed, including the four-player Herd Mentality flow,
  final target, replay, and return-to-party flows.
- Production HTTP smoke — `/health` and `/` returned HTTP 200.
- Production browser smoke — `1/1` passed against the freshly built server on
  `http://127.0.0.1:3000`; server stopped afterward.
- `pnpm audit` and `pnpm audit --audit-level=high` — no known vulnerabilities
  found after the workspace override `qs: 6.16.0`; `pnpm why` confirms one qs
  version on both Express paths.
- Graphify refresh/query — not verified: the available CLI probe timed out;
  no Graphify result is claimed.

## Explicit non-goals for the first slice

- No copied commercial prompts, branding, artwork, or title assets.
- No AI or human semantic synonym service for answer grouping.
- No database, prompt editor, moderation dashboard, or hot-reload content.
- No new platform-wide party/auth infrastructure.
- No host-only setup screen.
- No deployment/VPS/GHCR publication claim without separate owner-controlled
  verification.
