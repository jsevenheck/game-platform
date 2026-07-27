# Estimate Architecture

Estimate follows the same drop-in module shape as the other games: shared core types,
Socket.IO server handlers, and a Vue platform adapter.

## Phase machine

```
lobby ──► guessing ──► allSubmitted ──► reveal ──► guessing (next round)
                                                └─► gameEnd ──► lobby (via restart)
```

- **`lobby`** — players are joined. Host can start once `players.length >= MIN_PLAYERS`.
- **`guessing`** — the question is visible to every connected player. Players submit one
  number each (last write wins). The server does not auto-submit on a timer — the UI shows a
  hint, the player submits when ready.
- **`allSubmitted`** — server-driven transition once every _connected_ player has submitted.
  The room view shows every guess on the number line. The solution stays hidden until the
  host presses the explicit `revealSolution` event.
- **`reveal`** — host pressed "Auflösen". The solution marker appears on the number line,
  winner(s) are highlighted, and the host sees the "Nächste Frage" button.
- **`gameEnd`** — last round completed. The platform adapter overlays replay / return-to-party
  buttons on top of the final scoreboard.

The `'allSubmitted'` ↔ `'reveal'` split is important: without it, the UI cannot distinguish
"everyone has spoken, time to show the guesses" from "the host actually revealed the answer
and we should show the winner banner".

## Server modules

| Module                         | Responsibility                                                    |
| ------------------------------ | ----------------------------------------------------------------- |
| `models/room.ts`               | in-memory room store keyed by `roomCode` and `matchKey`           |
| `models/player.ts`             | `createPlayer`, socket-id index, resume-token generation          |
| `managers/scoreManager.ts`     | `computeRoundWinners` (pure helper, easy to test)                 |
| `managers/broadcastManager.ts` | `buildRoomView` — the single source of truth for what clients see |
| `managers/roundManager.ts`     | state transitions, guess validation, scoring, advance / restart   |
| `utils/questionLibrary.ts`     | CSV parser, cache, fallback to `DEFAULT_QUESTIONS`                |
| `socketHandlers.ts`            | Socket.IO event handlers, host-gating, instrumentation            |

`broadcastManager` is the single place where game state becomes client-visible state.
Both `solution` (only after `reveal`) and `displayRange` (always present once any guess
exists) are derived here, so the UI does not have to re-implement the rules.

## Display range computation

`core/src/range.ts` exposes `computeDisplayRange(guesses, solution?)` which:

1. collects the min and max of the submitted guesses,
2. adds 10% of the guess span on each side,
3. clamps the span to at least `MIN_DISPLAY_SPAN` (so close-together guesses still have
   a visible band),
4. widens the range to include the solution if the solution is outside the guess span.

The UI then linearly maps each guess onto the band; markers stack vertically when two
guesses land within 4% of each other so nothing overlaps.

## Host gating

Host identity is **server-derived**, never client-supplied. `autoJoinRoom` calls
`syncRoomHostAfterJoin` from `apps/platform/server/party/gameAuth.ts` after `authorizePartyJoin`,
then re-applies the resulting `isHost` flags back to the room's player array. Host-only
events (`startGame`, `revealSolution`, `nextRound`, `restartGame`) re-check `isHost` against
the socket binding inside the handler — the client `isHost` prop is treated as a hint only.

## First-join player id

When a new room is created on the first `autoJoinRoom`, the room's host is bound to the
**platform-authoritative playerId** (`authorization.member.playerId`), not to a fresh
nanoid. This makes reconnects work: the second `autoJoinRoom` from the same player can
match `existing = room.players.find(p => p.id === authorizedPlayerId)` and resume the slot
instead of attempting to add a new one (which would fail with `'Name already taken'`).

## Files of interest

- `games/estimate/core/src/types.ts` — `Phase`, `RoomView`, `PlayerView`, `GuessEntry`,
  `ScoreEntry`, `WinnerEntry`, `StoredSession`, `Question`
- `games/estimate/core/src/range.ts` — `computeDisplayRange`
- `games/estimate/core/src/constants.ts` — `MIN_PLAYERS`, `MAX_PLAYERS`, `DEFAULT_TOTAL_ROUNDS`,
  `MIN_DISPLAY_SPAN`, `GUESS_VALUE_LIMIT`, `DEFAULT_QUESTIONS`
- `games/estimate/server/src/socketHandlers.ts` — entry point + all Socket.IO handlers
- `games/estimate/ui-vue/src/App.vue` — root component, phase routing, socket lifecycle
- `games/estimate/ui-vue/src/components/NumberLine.vue` — auto-scaled CSS-line with
  stacked markers and the gold solution marker
