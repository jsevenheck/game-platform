# Kritzelagent — Implementation Plan

> **Status:** Phase 8 complete; all local gates passed
> **Branch:** `feat/kritzelagent` (from `feat/estimate-game` @ `ff4333f`)
> **Author:** Hermes Agent
> **Game-ID:** `kritzelagent`

---

## 1. Concept

**Kritzelagent** is a browser-first drawing and deduction party game for the
existing `game-platform`. Everyone contributes to one shared picture, but one
player receives only the category and does not know the secret topic.

The game is inspired by the broad hidden-information/drawing pattern of _A Fake
Artist Goes to New York_, but uses original naming, prompts, UI, scoring, and
implementation. The platform host remains only the party/lifecycle host; no
separate game-master setup is required.

### Per round

1. The server selects a category and secret topic from the bundled library.
2. One player is secretly assigned the **Kritzelagent** role and sees only the
   category. All other players see category + topic.
3. Players draw one short stroke each in a deterministic player order. The
   server broadcasts accepted strokes to every connected client.
4. After two drawing turns per player, everyone votes for one suspect. Players
   cannot vote for themselves.
5. If the Kritzelagent receives the most votes, they get one private topic guess.
6. The Kritzelagent earns 2 points when they avoid the vote or guess the topic
   after being caught. If they are caught and miss the topic, every artist earns
   1 point.
7. The next round rotates the drawing order and selects a new agent. After the
   configured rounds, the platform's standard replay/return overlay is shown.

### Scope decisions for the first implementation

- **Players:** 5–12. The source game is documented for 5–10 players; the
  platform implementation supports two additional players with a responsive
  canvas and compact roster.
- **Rounds:** 5 by default.
- **Drawing:** pointer/touch strokes are represented as normalized point arrays;
  no image uploads, filesystem writes, or free-form HTML/SVG are accepted.
- **Stroke limit:** one contiguous stroke per turn, maximum 80 points after
  client-side simplification and server-side validation.
- **Private state:** the agent's identity and the topic are never included in a
  public room view. The server sends each player a recipient-specific private
  assignment event.
- **Voting:** one vote per player, submitted through a typed Socket.IO event;
  vote totals remain hidden until all eligible connected players have voted.
- **Disconnects:** a disconnected player is excluded from the current round's
  completion quorum, but their already accepted strokes remain visible. A
  reconnecting player resumes the same authorized slot and private assignment.
- **Round completion:** when all connected/eligible players have submitted both
  strokes and voted, the server resolves automatically; no special game host is
  required.

## 2. Phase machine

```text
lobby → drawing → voting → agentGuess → reveal → drawing (next round)
                                      └──────→ ended
```

- `lobby`: party members are joined; platform-authoritative host starts.
- `drawing`: category is public; topic/role are private; the current player may
  submit exactly one stroke for the active turn.
- `voting`: the complete canvas is public; eligible players submit one suspect.
- `agentGuess`: only the caught agent may submit a topic guess; other players
  see a waiting state.
- `reveal`: agent, topic, vote counts, outcome, and score delta are public.
- `ended`: final scoreboard remains visible; `PlatformAdapter.vue` shows the
  standard replay/return actions.

## 3. Core contracts

### Public `RoomView`

```ts
{
  roomCode: string;
  phase: 'lobby' | 'drawing' | 'voting' | 'agentGuess' | 'reveal' | 'ended';
  currentRound: number;
  totalRounds: number;
  category: string | null;
  strokes: StrokeView[];
  players: PlayerView[];
  votes: VoteStatus[];       // who has voted, not whom they selected
  revealedAgentId: string | null;
  revealedTopic: string | null;
  voteCounts: VoteCount[];
  roundResult: RoundResult | null;
  scores: ScoreEntry[];
}
```

`RoomView` never contains the secret topic or agent before `reveal`. A separate
`privateAssignment` event is sent only to the authorized socket/player:

```ts
{
  category: string;
  topic: string | null;
  isAgent: boolean;
}
```

### Socket events

Client → server:

- `autoJoinRoom`
- `startGame` (host-only)
- `submitStroke` (active player only)
- `submitVote` (one vote per connected player)
- `submitAgentGuess` (caught agent only)
- `nextRound` (host-only, after reveal)
- `restartGame` (host-only, after reveal or ended)
- `syncAuthority`

Server → client:

- `roomUpdate`
- `privateAssignment`
- `phaseChange`
- `error`

Every action uses acknowledgement responses, validates `unknown` payloads, and
records expected rejections separately from unexpected failures.

## 4. Data library

File: `games/kritzelagent/server/data/topics.csv`

```csv
category,topic
Tiere,Pinguin
Essen,Spaghetti
Orte,Leuchtturm
Berufe,Feuerwehrmann
Natur,Vulkan
```

The loader validates UTF-8 CSV rows, rejects empty category/topic values and
requires at least one valid entry. It shuffles a no-repeat deck per match and
resets the deck on restart. Tests inject a file reader rather than mocking
`node:fs`.

## 5. Implementation checklist

> Each phase is a coherent checkpoint. Tests are written before the behavior
> implementation wherever practical.

### Phase 0 — Scaffold and all platform wiring

- [x] `games/kritzelagent/package.json`
- [x] `games/kritzelagent/core/src/{types,constants,events}.ts`
- [x] `games/kritzelagent/server/src/index.ts`
- [x] `games/kritzelagent/ui-vue/{tsconfig.json,env.d.ts}`
- [x] `games/kritzelagent/ui-vue/src/{App.vue,PlatformAdapter.vue}`
- [x] `apps/platform/server/registry/index.ts`
- [x] `apps/platform/src/games/index.ts`
- [x] `apps/platform/vite.config.ts` (`@kritzelagent-ui` alias)
- [x] `apps/platform/env.d.ts`
- [x] `apps/platform/src/styles/main.css` (Kritzelagent tokens)
- [x] `vitest.projects.ts`
- [x] root `package.json` (`test:kritzelagent`)
- [x] `Dockerfile` package manifest copies
- [x] `pnpm install --lockfile-only`
- [x] `pnpm typecheck`, `pnpm lint` and `git diff --check`
- [x] **Commit:** `chore(kritzelagent): scaffold new game`

### Phase 1 — Topic library and pure drawing/vote rules

- [x] `server/src/utils/topicLibrary.ts`
- [x] `server/data/topics.csv` (at least 40 original DE topics)
- [x] `core/src/drawing.ts` (normalize/validate bounded strokes)
- [x] `server/src/managers/scoreManager.ts`
- [x] `__tests__/topicLibrary.test.ts`
- [x] `__tests__/drawing.test.ts`
- [x] `__tests__/scoreManager.test.ts`
- [x] **Focused result:** 22 tests passed

### Phase 2 — Authoritative room and round lifecycle

- [x] `server/src/models/player.ts`
- [x] `server/src/models/room.ts`
- [x] `server/src/managers/roundManager.ts`
- [x] `server/src/managers/broadcastManager.ts`
- [x] Tests for connected-player quorum, turn order, no-repeat topics,
      private/public state separation, reconnect, cleanup, and tie handling

### Phase 3 — Socket handlers and security boundary

- [x] `server/src/socketHandlers.ts`
- [x] `core/src/events.ts` finalized against runtime handlers
- [x] `__tests__/socketHandlers.test.ts`
- [x] Authorization tests for `joinToken`, resume token, host-only actions,
      active-turn ownership, self-vote rejection, agent-only guess, malformed
      strokes, and hidden topic/role leakage
- [x] Shared namespace connection and per-handler metrics instrumentation
- [x] Structured lifecycle logs without secrets or hidden game state

### Phase 4 — Vue state and socket shell

- [x] `ui-vue/src/stores/game.ts`
- [x] `ui-vue/src/composables/useSocket.ts`
- [x] `ui-vue/src/App.vue`
- [x] `ui-vue/src/PlatformAdapter.vue`
- [x] transport/join-pending/retry/error states and private assignment handling

### Phase 5 — Drawing UI

- [x] `ui-vue/src/components/Lobby.vue`
- [x] `ui-vue/src/components/DrawingCanvas.vue`
- [x] `ui-vue/src/components/DrawingView.vue`
- [x] responsive pointer/touch canvas with keyboard-safe surrounding controls
- [x] visible turn indicator, category/topic disclosure, stroke status,
      disconnected-player status, and accessible live announcements
- [x] no color-only role/outcome signaling; focus-visible controls; reduced
      motion support; mobile-first layout

### Phase 6 — Voting, reveal, and end UI

- [x] `ui-vue/src/components/VotingView.vue`
- [x] `ui-vue/src/components/AgentGuessView.vue`
- [x] `ui-vue/src/components/RevealView.vue`
- [x] `ui-vue/src/components/GameOver.vue`
- [x] vote lock state, agent-only guess form, result announcement, scoreboard,
      and standard platform overlay

### Phase 7 — E2E and runtime closure

- [x] `e2e/game.spec.ts`
- [x] host-as-player launch flow with 5 browser contexts
- [x] private assignment isolation (artist never sees agent topic)
- [x] two-turn stroke flow and public canvas reveal
- [x] voting, caught-agent incorrect guess branch
- [x] complete Playwright suite: **61/61 passed**

### Phase 8 — Documentation and final gates

- [x] `games/kritzelagent/README.md`
- [x] `games/kritzelagent/docs/api.md`
- [x] `games/kritzelagent/docs/architecture.md`
- [x] `docs/games.md`, `docs/README.md`, `docs/observability-metrics.md`, root `README.md`
- [x] full `pnpm install --frozen-lockfile`
- [x] `pnpm test:kritzelagent` — 5 files / 22 tests passed
- [x] `pnpm test` — 41 files / 390 tests passed
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm build` plus production health/asset smoke (`/health`, `/metrics`, CSV asset)
- [x] `pnpm test:e2e` — 61/61 passed
- [x] `pnpm audit --audit-level=high` — no known vulnerabilities
- [ ] clean tree and exact local/remote SHA verification after push

## 6. Best-practice guardrails

- Build server/core truth before UI behavior; do not infer rules from the
  canvas.
- Keep secret topic and agent identity recipient-specific until reveal.
- Use `authorizePartyJoin` and `syncRoomHostAfterJoin`; never trust client
  `isHost`, `playerId`, `name`, or role claims for authorization.
- Validate every socket payload from `unknown`; cap stroke points and reject
  non-finite/out-of-range coordinates.
- Keep scoring and stroke normalization pure and unit-tested.
- Use Vue 3 `<script setup lang="ts">`, typed props/emits, Pinia setup stores,
  component-scoped styles, shared design tokens, semantic controls, and
  `focus-visible` states.
- Use role/label locators and web-first Playwright assertions; type-check E2E
  files separately.
- Update user-facing docs in the same feature slice as the implementation.
- Do not claim browser, production, provider, or remote verification unless the
  corresponding gate has actually run.
