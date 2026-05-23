# Scout — Game Specification

**Game ID:** `scout`
**Name:** `Scout`
**Min Players:** 2
**Max Players:** 5
**Genre:** Card game, trick-taking / ladder-climbing
**Designer:** Kei Kajino
**Original Publisher:** Oink Games

---

## 1. Overview

Scout is a card game where each player receives a dealt row of cards and may once optionally flip their entire row left-to-right. Cards remain in fixed row order for the entire game. Players play tricks by selecting contiguous subsequences from their row, using a ladder-climbing mechanic. Played cards are kept for their "scout" points. The game ends when a player empties their row or the card supply is exhausted.

---

## 2. Deck

- 45 cards total
- Card values: 1 through 10
- Each value appears a varying number of times (e.g., 1 appears once, 2 appears twice, ..., up to a distribution that totals 45)
- Each card has **two distinct numbers** printed (e.g., one in the top-left corner, one in the bottom-right)
- The currently "active" corner determines which number is used for **playing tricks** vs. **scoring at game end**

> **Implementation note:** Use `{ kind: 'scout', value: number, scout: number }` for each card. One field is the `playValue` (used to determine trick rank), the other is the `scoutPoints` (used for end-game scoring). Flipping a card swaps these two values.

---

## 3. Setup Flow

1. Shuffle deck
2. Deal **all** cards equally among players (any remainder sits in a face-up "show pile")
3. Each player has a **private row** of cards in dealt order
4. Each player secretly examines their row
5. Each player may **once** choose to flip their **entire row**:
   - Reverses the card order (leftmost becomes rightmost)
   - Individually flips every card (swaps playValue ↔ scoutPoints on each card)
6. After this optional initial flip, card order is **fixed** for the entire game — no reordering, no inserting between existing cards

---

## 4. Game Flow — Trick-Taking

### 4.1 Trick Leader
- The first dealer (host) leads the first trick
- After each trick, the **winner of that trick** leads the next
- Turn order proceeds clockwise

### 4.2 Playing a Trick
- The leader selects a **contiguous subsequence** of 1 or more cards from their row
- A contiguous subsequence means cards that are adjacent in the row, preserving left-to-right order

### 4.3 Ladder-Climbing Rules ("Beating" a Play)
Each subsequent player in turn order must either:

1. **Play** a contiguous subsequence that "beats" the current highest play (the last played cards on the table):
   - **Higher total sum** of `playValue` → wins, OR
   - **Same total sum** but with **more cards** → wins, OR
   - **Same total sum** and **same card count**, but the **highest single card value** is greater → wins
   - Example: [5,4] total=9 beats [3,3,3] total=9 (same sum, but 3 cards > 2 cards → NO, wait. More cards is BETTER in some climbing games. Let me re-check).

> In standard ladder climbing: Higher sum first, then more cards if sum is tied, then highest card if both sum and count are tied.

2. **Pass** (also called "Scout"):
   - The player **does not play** any cards
   - Instead, they add one card to their row
   - Where the card comes from: either the face-up show pile, or from another player's played cards on the table
   - When scouting from another player's played cards: you may take **one card** from any sequence currently on the table and add it to either **end** of your row (leftmost or rightmost)

3. **Show** — special action:
   - When passing without playing, you may "show" that you could have beaten the current play (by revealing a beating hand from your row)
   - This gives you a bonus or affects scoring

### 4.4 Trick Resolution
- The trick continues around the table until all players but one have passed
- The **last player who played cards** wins the trick and collects **all cards played by ALL players in this trick**
- These collected cards go to the winner's personal "taken" pile for end-game scoring
- The winner leads the next trick

---

## 5. Scoring & End Game

### 5.1 End Conditions
The game ends immediately when **any** of the following occurs:
- A player plays their **last card(s)** from their row (they have no cards left)
- The show pile / supply is exhausted AND no more scouting is possible
- A configurable round limit is reached (optional)

### 5.2 Scoring
Each player counts the **scout points** (the `scout` value, NOT the play value) on all cards in their personal "taken" pile:
- Total up all scout numbers
- The player with the **highest total** wins the game
- Ties are broken by number of cards taken, then by highest single scout card

---

## 6. Platform Integration Requirements

Follow the `docs/adding-a-new-game.md` checklist exactly. The game must:

### 6.1 Core (`games/scout/core/src/`)
- `types.ts` — Room, Player, ScoutCard, TrickState, GamePhase (= 'lobby' | 'playing' | 'scoring' | 'ended')
- `constants.ts` — MIN_PLAYERS=2, MAX_PLAYERS=5, DECK_SIZE=45, card distribution
- `events.ts` — Socket.IO events mirroring the flip7 pattern
- `deck.ts` — buildDeck() function creating the 45-card Scout deck with dual-value cards

### 6.2 Server (`games/scout/server/src/`)
- `index.ts` — exports `definition`, `register()`, `cleanupMatch()`
- `models/room.ts` — room store with create/get/delete, session mapping
- `models/player.ts` — player model with resumeToken, isHost, etc.
- `managers/trickManager.ts` — trick logic: valid plays, ladder-climbing comparison, trick resolution
- `managers/broadcastManager.ts` — roomUpdate broadcasts with client-safe views
- Use all platform helpers:
  - `createComponentLogger`, `createSocketLogger`
  - `attachSocketEventDebugLogging`
  - `startSocketHandlerInstrumentation`
  - `recordNamespaceConnection`, `recordNamespaceDisconnect`

### 6.3 UI (`games/scout/ui-vue/src/`)
- `App.vue` — root component connecting to Socket.IO, handling room updates, emitting `phase-change`
- `PlatformAdapter.vue` — platform wrapper with replay/lobby overlay
- `composables/useSocket.ts` — Socket.IO composable
- `stores/game.ts` — Pinia store
- Components:
  - `Lobby.vue` — waiting room with player list, start button (host only)
  - `SetupFlip.vue` — initial row display with "Flip Row" / "Keep" buttons (only shown once at game start)
  - `GameTable.vue` — main game view showing each player's row (self visible, others hidden/back-face), current trick plays, turn indicator
  - `Card.vue` — individual card display with dual numbers
  - `PlayControls.vue` — card selection for playing a contiguous subsequence
  - `ScoutDialog.vue` — dialog when passing/scouting (choose: take from show pile or from table)
  - `TrickHistory.vue` — log of played tricks
  - `GameOver.vue` — final scores display

### 6.4 Tests
- `__tests__/` — Vitest unit tests
- `e2e/` — Playwright E2E specs

### 6.5 Platform Registration Points
1. `apps/platform/server/registry/index.ts` — add scout module
2. `apps/platform/src/games/index.ts` — add client entry with `platformMeta`
3. `apps/platform/vite.config.ts` — add `@scout-ui` alias + `@shared` plugin branch
4. `apps/platform/src/styles/main.css` — add `--color-scout` game accent
5. `Dockerfile` — add `COPY games/scout/package.json games/scout/`
6. `vitest.projects.ts` — add scout project

---

## 7. Visual Design

- **Game accent color:** Teal/cyan-green `#14b8a6` (distinct from existing: blackout=violet, imposter=crimson, signals=cyan, flip7=amber)
- Cards should be visually distinct with a dark card face showing both numbers
- Opponents' rows show cards face-down (revealing only count)
- Own row shows face-up with selectable highlighting
- Current trick shows played cards in the center of the table

---

## 8. Multiplayer Considerations

- Since cards are dealt from a shared deck, the total player count determines hand size
- With 2 players: ~22 cards each + 1 in show pile
- With 5 players: ~9 cards each
- Turn order must be deterministic and visible to all players
- Scouting from another player's played cards must be validated (card must exist on table)
- When a player disconnects, their row is preserved; they can reconnect via resumeToken
- If host disconnects, a new host is auto-assigned
