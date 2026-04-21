# Flip 7 — Architecture

## State machine

```
         autoJoinRoom (host)
              │
         ┌────▼────┐
         │  lobby  │◄──────────────────────────────────── playAgain (host)
         └────┬────┘
              │ startGame (host, ≥3 players)
              │
         ┌────▼─────┐        roundEndReason set,
         │ playing  │────── no winner yet ──► roundEnd ──────┐
         └────┬─────┘                                         │
              │                                          (after 4 s)
              │ roundEndReason set,                           │
              │ one clear winner                         ┌────▼────┐
              └──────────────────────────────────────────► playing │
                                                          └─────────┘
              │ (alternate path: clear winner)
         ┌────▼────┐
         │  ended  │
         └─────────┘
```

## Round lifecycle

1. `startRound` builds a fresh 94-card deck (shuffle via Fisher–Yates), resets all `RoundPlayer` states to `active`, and sets the turn order starting from the dealer position (rotates each round; host acts first in round 1).
2. Turn loop: active player emits `hit` or `stay`.
   - **hit** → `playerHit` draws the top card:
     - `number` → `applyNumberCard` (duplicate = bust / second-chance save; 7th unique = Flip 7)
     - `modifierAdd` → accumulate flat bonus, advance turn
     - `modifierX2` → set `hasX2`, advance turn
     - `action` → `openPendingAction`; auto-resolves when only one eligible target
   - **stay** → `playerStay` sets status `stayed`, advance turn
3. Pending action: drawer calls `chooseActionTarget`. Server validates and resolves:
   - All implemented action cards may target any `active` player, including the drawer.
   - If the drawer is the only active player left, the action auto-resolves on that player.
   - `freeze` → target status = `stayed`
   - `flipThree` → target gets 3 forced draws (they emit `hit` for each); current turn switches to target
   - `secondChance` → target gains the bust-protection token (or advances if already held)
4. Round ends when:
   - All players are `stayed` or `busted` (`roundEndReason = 'allDone'`)
   - A player collects 7 unique number cards (`roundEndReason = 'flip7'`) → instant end + Flip 7 bonus
5. `finalizeRound` computes per-player round scores and adds to `totalScore`. Winner check runs via `computeWinners`:
   - 0 players ≥ target → `roundEnd` phase for 4 s, then new round
   - 1 player at the top ≥ target → `ended`
   - 2+ players tied at top ≥ target → extra round (return empty from `computeWinners`)

## Score formula

```
score = (sum of numberCards × (hasX2 ? 2 : 1)) + sum(modifierAdds) + (isFlip7Trigger ? 15 : 0)
```

- Busted players always score **0** regardless of held cards.
- `x2` doubles the **number sum only**; flat modifiers and the Flip 7 bonus are added after.
- The Flip 7 bonus (15 pts) goes only to the triggering player.
- `targetScore` is fixed at **200** for Flip 7 and is not player-configurable.

## Deck management

- `buildDeck()` produces 94 cards (79 numbers, 5 flat modifiers, 1 ×2, 9 action cards).
- `draw(round)` pops from the back of `deck[]`. If empty, calls `reshuffleFromDiscard` which moves all `discard` cards back into `deck` and shuffles them. Cards currently in front of players are **never** reshuffled.

## Broadcasting / privacy

`broadcastRoom(nsp, room)` iterates connected players and emits `roomUpdate` to each.
`toRoomView` strips:

- `deck` and `discard` arrays → replaced with `deckSize` / `discardSize` integers
- `resumeToken` on every `Player` → never appears in any view

All player face-up cards (`numberCards`, `modifierAdds`, `hasX2`) are public — the rules require them to be visible.

## Reconnection

`autoJoinRoom` handles reconnect by matching on stable `playerId` from socket auth or request body. A `resumeToken` is required for any player slot that was already active; mismatched tokens are rejected to prevent session hijacking.

On disconnect, the host role is transferred to the next connected player. If all players disconnect, a 5-minute idle cleanup timer is scheduled.

## Logging

All lifecycle events (room create, join, resume, start, round end, match end, cleanup) are emitted via `createComponentLogger('game-server', { gameId: 'flip7' })`. Sensitive fields (`resumeToken`, `inviteCode`) are never logged.

## Metrics

Two Prometheus gauges track flip7 activity:

- `platform_match_active{game_id="flip7"}` — active room count
- `platform_room_players_connected{game_id="flip7"}` — connected player count

Both are collected via `getRoomSnapshot()` in `apps/platform/server/metrics/collectors.ts`.
