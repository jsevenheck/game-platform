# Plan: Add "Flip 7" Card Game

## ✅ Implementation Status — 2026-04-11

**All checklist items complete. `typecheck`, `lint`, `pnpm test` (190 tests, 22 files) all pass.**

| Area | Status |
|------|--------|
| `games/flip7/` scaffold | ✅ |
| Core types, deck, events, constants | ✅ |
| Server models (room, player) | ✅ |
| Server managers (deck, round, score, phase, broadcast) | ✅ |
| Socket handlers + index.ts | ✅ |
| Platform registry, client, Vite alias, CSS token, metrics, vitest | ✅ |
| UI (PlatformAdapter, App, Lobby, GameTable, PlayerBoard, HitStay, ActionPicker, RoundSummary, GameOver) | ✅ |
| Unit tests (deck, scoreManager, roundManager, socketHandlers) | ✅ |
| E2E tests (`games/flip7/e2e/game.spec.ts`) | ✅ |
| Docs (api.md, architecture.md) | ✅ |

**Next step:** `pnpm test:e2e` with 3+ browser contexts to run the Playwright E2E suite end-to-end.

---

## Context

The game-platform monorepo currently ships three games (blackout, imposter, secret-signals). The user wants to add a fourth: **Flip 7**, a push-your-luck card game (first to 200 points wins). The implementation must follow the exact patterns documented in [AGENTS.md](AGENTS.md) and [docs/adding-a-new-game.md](docs/adding-a-new-game.md), and mirror the structure of [games/blackout/](games/blackout/) — which is the cleanest reference implementation for a round-based multiplayer game. No new frameworks; reuse platform logging, metrics, observability, Vite aliasing, Tailwind tokens, and the in-memory room store pattern.

The engine must correctly model every rule in the brief: deck composition (0–12 number cards with count = value, modifiers `+2/+4/+6/+8/+10/x2`, actions `Freeze`/`Flip Three`/`Second Chance`), hit/stay turn loop, bust on duplicate number, Flip 7 instant round-end with +15 bonus, action resolution (including mandatory self-target when solo, resolution of action cards drawn mid-Flip-Three), scoring formula (`(sum of numbers) × (x2 modifier) + flat modifiers + 15 Flip 7 bonus`, with `x2` applied to numbers only), round reshuffle from discard when deck empties mid-round, and the "first to ≥200 at end of round wins; tie → extra round" terminal condition.

## Game design decisions (mirror blackout, adapted for Flip 7)

| Decision                | Value                                                          | Why                                                                                                  |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `id` / `name`           | `flip7` / `Flip 7`                                             | kebab-case id used in paths, namespace, Vite aliases                                                 |
| Min/max players         | 3 / 18                                                         | Official Flip 7 box is 3–18; matches other platform games                                            |
| Target score            | 200 (configurable in lobby, default 200)                       | Official rules; host can tune for shorter demos                                                      |
| Turn order              | Seated order, rotates each round (dealer button advances)      | Standard; deterministic, no extra UI                                                                 |
| Action-card targeting   | Player who drew an action card picks target from active list  | Required by rules; auto-target self if solo. Server holds a `pendingAction` sub-state until resolved |
| Deck persistence        | In-memory per-room `Deck` object, reshuffled from discard mid-round when empty | Matches rules; no DB layer needed                                                                    |
| Data layer              | None — deck is generated from constants, no SQLite             | Unlike blackout, Flip 7 has no prompt database                                                       |

## Directory structure

```
games/flip7/
├── package.json
├── core/src/
│   ├── constants.ts          # MIN_PLAYERS, MAX_PLAYERS, DEFAULT_TARGET_SCORE, FLIP7_BONUS, DECK spec, timer constants
│   ├── deck.ts               # Card types + buildDeck(): Card[] (full 94-card deck per spec)
│   ├── types.ts              # Room, Player, RoundState, PendingAction, RoomView, Phase
│   └── events.ts             # ClientToServerEvents, ServerToClientEvents
├── server/src/
│   ├── index.ts              # exports definition, register, cleanupMatch (thin wrapper, mirrors blackout)
│   ├── socketHandlers.ts     # registerFlip7(io, namespace): all socket events + instrumentation
│   ├── models/
│   │   ├── room.ts           # createRoom/getRoom/deleteRoom/sessionToRoom/getRoomSnapshot + cleanup timers
│   │   └── player.ts         # createPlayer/setSocketIndex/getSocketIndex (copy from blackout)
│   └── managers/
│       ├── broadcastManager.ts  # toRoomView(room, playerId) + broadcastRoom(nsp, room)
│       ├── deckManager.ts       # shuffle, draw, reshuffleFromDiscard
│       ├── roundManager.ts      # startRound, playerHit, playerStay, resolveActionCard, finalizeRound
│       ├── scoreManager.ts      # calculatePlayerRoundScore (numbers * x2 + flats + bonus)
│       └── phaseManager.ts      # transitions: lobby → playing → roundEnd → (playing | ended)
├── ui-vue/
│   ├── tsconfig.json         # copy from blackout verbatim; @shared/* → ../core/src/*
│   ├── env.d.ts
│   └── src/
│       ├── PlatformAdapter.vue   # wraps App.vue, handles phase-change → ended overlay
│       ├── App.vue               # socket connect + autoJoinRoom + roomUpdate listener + phase-change emit
│       └── components/
│           ├── Lobby.vue         # host sees target-score stepper + Start button; players see roster
│           ├── GameTable.vue     # main play area — active players, decks, discard, turn indicator
│           ├── PlayerBoard.vue   # one active player's face-up cards, status (active/stayed/busted), 2nd-chance token
│           ├── HitStayControls.vue  # buttons when it is *your* turn and no action is pending
│           ├── ActionTargetPicker.vue  # modal when you drew an action card and must choose a target
│           ├── RoundSummary.vue  # totals + bonus breakdown + running score at end of round
│           └── GameOver.vue      # final winner screen
├── __tests__/
│   ├── deck.test.ts              # deck composition + shuffle determinism
│   ├── roundManager.test.ts      # hit/stay/bust/Flip7/action resolution (pure functions)
│   ├── scoreManager.test.ts      # score formula edge cases
│   └── socketHandlers.test.ts    # in-memory socket harness (copy blackout pattern)
├── e2e/
│   └── game.spec.ts              # party → launch → play one round via platform flow
└── docs/
    ├── api.md                    # socket events + payloads
    └── architecture.md           # state machine + lifecycle logs
```

## Core domain model

### `core/src/deck.ts`
```ts
export type NumberCard  = { kind: 'number'; value: 0|1|2|3|4|5|6|7|8|9|10|11|12 };
export type ModifierAdd = { kind: 'modifierAdd'; bonus: 2|4|6|8|10 };
export type ModifierX2  = { kind: 'modifierX2' };
export type ActionCard  = { kind: 'action'; action: 'freeze'|'flipThree'|'secondChance' };
export type Card = NumberCard | ModifierAdd | ModifierX2 | ActionCard;

export function buildDeck(): Card[] {
  // 0 ×1, 1 ×1, 2 ×2, … 12 ×12  →  79 number cards
  // +2,+4,+6,+8,+10 each ×1     →   5 modifier-add cards
  // x2 ×1                        →   1 multiplier card
  // Freeze ×3, Flip Three ×3, Second Chance ×3 → 9 action cards
  // = 94 cards total
}
```

### `core/src/types.ts` (shape)
```ts
export type Phase = 'lobby' | 'playing' | 'roundEnd' | 'ended';

export interface Player {
  id: string; name: string; socketId: string | null; connected: boolean;
  isHost: boolean; resumeToken: string;
  totalScore: number;          // banked across all rounds
}

export type RoundPlayerStatus = 'active' | 'stayed' | 'busted';

export interface RoundPlayer {
  playerId: string;
  status: RoundPlayerStatus;
  numberCards: number[];        // face-up numbers (unique while active)
  modifierAdds: number[];       // flat point adds
  hasX2: boolean;
  hasSecondChance: boolean;
  flipThreeRemaining: number;   // >0 while resolving a Flip Three
}

export interface PendingAction {
  // Set after a player draws an action card that requires a target.
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  eligibleTargets: string[];    // active playerIds (or self-only if solo)
}

export interface RoundState {
  roundNumber: number;
  turnOrder: string[];          // playerIds in play order this round
  currentTurnIndex: number;
  deck: Card[];                 // draw pile (top = last)
  discard: Card[];
  players: Record<string, RoundPlayer>;
  pendingAction: PendingAction | null;
  roundEndReason: 'allDone' | 'flip7' | null;
  flip7PlayerId: string | null;
}

export interface Room {
  code: string;
  ownerId: string | null;
  hostId: string | null;
  phase: Phase;
  players: Record<string, Player>;
  targetScore: number;          // default 200
  currentRound: RoundState | null;
  roundHistory: Array<{ roundNumber: number; scores: Record<string, number> }>;
  winnerIds: string[];          // set when phase === 'ended'
}
```

### `core/src/events.ts` (client→server actions)
- `autoJoinRoom(data, cb)` — **required contract**, matches docs
- `setTargetScore({ targetScore })` — host only, lobby only
- `startGame()` — host only
- `hit()` — current-turn player
- `stay()` — current-turn player
- `chooseActionTarget({ targetPlayerId })` — drawer of action card
- `playAgain()` — host only, from ended
- `requestState()` — resync

Server→client: **single `roomUpdate(view: RoomView)`** broadcast per state change (private fields like `deck`/`discard` order are redacted from the view; only card *counts* are sent so clients can't peek).

## Server mechanics — the engine

The engine is fully deterministic given `Math.random` inside `deckManager.shuffle`. All logic lives in pure manager functions that mutate the passed `Room`; the socket handler only validates and calls them.

### `deckManager`
- `shuffle(deck: Card[]): Card[]` — Fisher–Yates
- `draw(round: RoundState): Card` — pops top; if empty, `reshuffleFromDiscard(round)` first. Rule: reshuffle only the discard pile, **never** cards currently in front of players.

### `roundManager`

```ts
startRound(room): void
  // Rotate dealer, build fresh deck via buildDeck() + shuffle, reset RoundPlayer entries,
  // set turnOrder, currentTurnIndex=0, pendingAction=null.

playerHit(room, playerId): void
  // Validates it's playerId's turn and no pendingAction is open.
  // const card = draw(round); discard push (number/modifiers after resolved; actions go to discard after resolution too)
  // switch (card.kind) {
  //   case 'number': applyNumberCard(round, playerId, card)
  //   case 'modifierAdd': player.modifierAdds.push(card.bonus); advanceTurn()
  //   case 'modifierX2':  player.hasX2 = true; advanceTurn()
  //   case 'action':      openPendingAction(round, playerId, card) // may auto-resolve if solo
  // }

applyNumberCard(round, playerId, card)
  // Check duplicate: if player.numberCards.includes(card.value)
  //   if hasSecondChance: discard duplicate + second chance, hasSecondChance=false, advanceTurn/continueFlipThree
  //   else: bust(player); if this was inside a flipThree, stop remaining draws
  // else: player.numberCards.push(value)
  //   if (numberCards.length === 7): triggerFlip7(round, playerId)
  //   else: continueFlipThreeOrAdvance()

chooseActionTarget(room, drawerId, targetId): void
  // Validates pendingAction.drawerId === drawerId, targetId ∈ eligibleTargets.
  // Execute:
  //   freeze:       target.status = 'stayed' (bank points at round end)
  //   flipThree:    target.flipThreeRemaining = 3; next forced draw is target's, not drawer's
  //   secondChance: if target.hasSecondChance → keep drawn one and REDRAW (discard back), else target.hasSecondChance = true
  // Clear pendingAction, then advance or continue the in-progress flipThree.

playerStay(room, playerId)
  // status='stayed'. advanceTurn(). If no active players left → finalizeRound.

advanceTurn(round)
  // Skip stayed/busted. If any player has flipThreeRemaining>0, their forced draws take priority before advancing.
  // If no active players left → round ends (all done).

triggerFlip7(round, playerId)
  // round.roundEndReason='flip7'; round.flip7PlayerId=playerId; finalizeRound immediately.

finalizeRound(room)
  // For each RoundPlayer compute score via scoreManager.
  // Add to player.totalScore (0 for busted).
  // Push roundHistory entry.
  // Determine winners: players with totalScore >= targetScore.
  //   - 0 winners → phase='roundEnd' (brief intermission) → startRound next
  //   - 1 winner  → phase='ended', winnerIds=[that]
  //   - 2+ winners tied at the top → play another round (rules say "until there is a clear winner")
```

### `scoreManager`
```ts
calculatePlayerRoundScore(rp: RoundPlayer, isFlip7: boolean): number
  if (rp.status === 'busted') return 0;
  const numSum = rp.numberCards.reduce((a,b)=>a+b, 0);
  const numbers = rp.hasX2 ? numSum * 2 : numSum;
  const flats = rp.modifierAdds.reduce((a,b)=>a+b, 0);
  const bonus = isFlip7 ? 15 : 0;     // only flip7 triggerer gets bonus
  return numbers + flats + bonus;
```

Edge cases verified against the brief:
- `x2` doubles numbers only, not bonus, not flats ✓
- `0` is worth 0 points but still counts toward the 7 unique ✓ (just push 0 into `numberCards`)
- Busted player scores 0 regardless of modifiers held ✓
- Flip 7 bonus only to the triggerer, even if others also have 7 numbers (impossible, round ends immediately) ✓
- Reshuffle only the discard pile mid-round ✓
- Action cards drawn during a Flip Three still count as one of the three draws *and* execute ✓
- Action drawn when only drawer is active → must target self ✓

### Broadcast view
`toRoomView(room, playerId)` strips `round.deck` and `round.discard` to `deckSize` / `discardSize` integers. Player face-up cards are public (the rules require them visible). Resume token never broadcast. This mirrors the blackout pattern in [games/blackout/server/src/managers/broadcastManager.ts](games/blackout/server/src/managers/broadcastManager.ts).

## Socket handler (mirrors [games/blackout/server/src/socketHandlers.ts](games/blackout/server/src/socketHandlers.ts))

Every callback-bearing event wraps its callback with `startSocketHandlerInstrumentation(namespace, eventName)` → `instrumentation.wrapCallback(cb)`. Connect/disconnect calls `recordNamespaceConnection` / `recordNamespaceDisconnect`. The pattern is already in blackout — copy it verbatim.

`autoJoinRoom` handler enforces the full contract from [docs/adding-a-new-game.md:190](docs/adding-a-new-game.md#L190):
1. Create room if `sessionId` is unknown
2. Rejoin if player exists → validate `resumeToken` (reject `'Resume token required'` / `'Invalid resume token'`)
3. Respect `data.isHost`
4. Callback `{ ok: true, roomCode, playerId, resumeToken }`
5. Never include `resumeToken` in broadcast views

Host transfer on disconnect matches blackout: promote first remaining connected player. Cleanup timers use the same `ROOM_IDLE_TIMEOUT_MS` / `ROOM_ENDED_CLEANUP_MS` constants (copy into flip7 `core/src/constants.ts`).

## UI integration

`App.vue` follows the blackout App.vue shape: `useSocket` composable, local Pinia-free refs for the room view, `watch` for `phase-change` emits. Key render branches:

| Phase       | Component                                                |
| ----------- | -------------------------------------------------------- |
| `lobby`     | `Lobby.vue` (roster, target-score stepper, Start button) |
| `playing`   | `GameTable.vue` + per-player `PlayerBoard` grid          |
| `roundEnd`  | `RoundSummary.vue` (briefly, auto-advances)              |
| `ended`     | `GameOver.vue`; `phase-change` emits `'ended'` for the platform overlay |

`GameTable.vue` shows: deck size, discard size, current-turn highlight, each active player's numbers/modifiers/second-chance token, stayed/busted badges. `HitStayControls.vue` is only rendered when `view.round.currentTurnPlayerId === me && !view.round.pendingAction`. `ActionTargetPicker.vue` is rendered when `view.round.pendingAction?.drawerId === me`, showing the list of eligible targets (or auto-confirming on self when solo).

Use the platform design tokens (`bg-canvas`, `ui-panel`, `ui-btn-primary`, etc.) — no custom CSS variables. Add a flip7 accent color token.

## Platform registration touchpoints (exact edits)

All inferred from the **verified** current file contents:

1. **[apps/platform/server/registry/index.ts](apps/platform/server/registry/index.ts)** — add `flip7` import block (`flip7Def`, `flip7Register`, `flip7Cleanup`), `flip7Module`, and map entry `['flip7', flip7Module]`.
2. **[apps/platform/src/games/index.ts](apps/platform/src/games/index.ts)** — append `clientGameRegistry` entry with `loadClient: () => import('@flip7-ui/PlatformAdapter.vue')` and `minPlayers: 3, maxPlayers: 18`.
3. **[apps/platform/vite.config.ts](apps/platform/vite.config.ts)** — add `{ find: '@flip7-ui', replacement: resolve(GAMES_ROOT, 'flip7/ui-vue/src') }` to `resolve.alias`, and add `else if (normalized.includes('/games/flip7/')) { baseDir = resolve(GAMES_ROOT, 'flip7/core/src'); }` to `sharedAliasPlugin`.
4. **[apps/platform/src/styles/main.css](apps/platform/src/styles/main.css)** — inside `@theme`, add `--color-flip7: #<accent>` (+ hover/muted variants). The global `@source` glob already covers `games/*/ui-vue/src/**/*.vue`, so no extra `@source` needed.
5. **[apps/platform/server/metrics/collectors.ts](apps/platform/server/metrics/collectors.ts)** — add `getRoomSnapshot as getFlip7RoomSnapshot` import and two `.labels('flip7')` lines in the `roomsActiveGauge` and `roomPlayersConnectedGauge` collect callbacks (verified: this file already has the analogous 3 calls for blackout/imposter/secret-signals at lines 38–40 and 50–52).
6. **[vitest.projects.ts](vitest.projects.ts)** — export `flip7Project` with `@shared` alias and include glob, append to `allProjects`.
7. **[games/flip7/package.json](games/flip7/package.json)**, **[games/flip7/ui-vue/tsconfig.json](games/flip7/ui-vue/tsconfig.json)**, **[games/flip7/ui-vue/env.d.ts](games/flip7/ui-vue/env.d.ts)** — mirror blackout (verbatim modulo the name).

`playwright.config.ts` already globs `games/*/e2e/**/*.spec.ts` — no change.

## Files to create (new) vs. modify (existing)

**Modify (7 files):**
- `apps/platform/server/registry/index.ts`
- `apps/platform/src/games/index.ts`
- `apps/platform/vite.config.ts`
- `apps/platform/src/styles/main.css`
- `apps/platform/server/metrics/collectors.ts`
- `vitest.projects.ts`
- `README.md` or monorepo docs (optional listing of the new game)

**Create (all under `games/flip7/`):** full tree as shown above.

## Verification plan

1. `pnpm install` → expect no changes (workspace glob covers `games/*`).
2. `pnpm typecheck` → must pass across all projects including new `flip7`.
3. `pnpm lint` → must pass.
4. `pnpm test --project flip7` → unit tests:
   - `deck.test.ts`: asserts 94-card total, correct counts per card type
   - `scoreManager.test.ts`: covers bust=0, x2 on numbers only, flat + bonus addition, flip7 bonus only on triggerer
   - `roundManager.test.ts`: covers bust path, second-chance save, duplicate-after-second-chance bust, flip7 trigger, flipThree mid-action card resolution, reshuffle when deck empties mid-round
   - `socketHandlers.test.ts`: in-memory socket harness copied from blackout — autoJoinRoom create/rejoin/resumeToken, startGame authorization, hit/stay flow, end-of-round transition, reach-target win, tie → extra round
5. `pnpm test` → all other project tests still pass.
6. `pnpm dev` → manual smoke:
   - Open 3 browser contexts via `pnpm dlx playwright open` or the design-review skill
   - Create party, join, launch Flip 7, play a full round
   - Verify: hit/stay buttons only shown on your turn, action target picker appears for action cards, deck/discard counts update, banked scores accumulate across rounds, win at ≥200 shows `GameOver.vue` and the platform replay/return overlay
7. `pnpm test:e2e games/flip7/e2e/game.spec.ts` → platform-driven E2E for the golden path.
8. Manual check: tail server logs with `LOG_PRETTY=1 pnpm dev`; confirm lifecycle logs (room created, join, start, round end, match end, cleanup) emit and never print `resumeToken`, `joinToken`, or `inviteCode`.
9. `curl http://localhost:3000/metrics | grep flip7` → confirm `platform_match_active{game_id="flip7"}` and `platform_room_players_connected{game_id="flip7"}` gauges appear.

## Open questions for the user

Before implementing, please confirm the two points that shape scope:

1. **Target score configurable in lobby?** Rules say 200. Keep it hard-coded or expose a stepper?
2. **Flip7 accent color** for the Tailwind token — any preference, or pick a complementary hue (e.g. amber `#f59e0b`)?
