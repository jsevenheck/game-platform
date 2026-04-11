# Flip 7 — Socket.IO API

Namespace: `/g/flip7`

## Client → Server events

### `autoJoinRoom(data, cb)`

Creates or rejoins a Flip 7 room for the given session.

**Request:**
```ts
{
  sessionId: string;       // Platform matchKey — unique per match
  name: string;            // Player display name
  playerId?: string;       // Stable platform player ID (omit on first join)
  isHost?: boolean;        // True if this player should be host
  resumeToken?: string;    // Required when rejoining an existing player slot
}
```

**Response (`cb`):**
```ts
{ ok: true;  roomCode: string; playerId: string; resumeToken: string }
| { ok: false; error: string }
```

Error strings:
- `'Missing session info'` — sessionId or name is blank
- `'Resume token required'` — player slot exists but no token provided
- `'Invalid resume token'` — wrong token for existing slot
- `'Name already taken'` — another player in the lobby has the same name
- `'Game already started'` — trying to join a room mid-game

---

### `setTargetScore(data)`

Host only. Lobby only. Clamps value to `[MIN_TARGET_SCORE, MAX_TARGET_SCORE]` (50–500, step 25).

```ts
{ roomCode: string; targetScore: number }
```

---

### `startGame(data, cb)`

Host only. Requires ≥ 3 connected players.

```ts
// request
{ roomCode: string }

// response
{ ok: true } | { ok: false; error: string }
```

---

### `hit(data)`

Current-turn player draws a card. Ignored unless it is your turn, no `pendingAction` is open, and you are `active`.

```ts
{ roomCode: string }
```

Also used to draw a forced card during a Flip Three (when `flipThreeRemaining > 0` and it is your turn).

---

### `stay(data)`

Current-turn player banks their cards and passes. Ignored if `flipThreeRemaining > 0`.

```ts
{ roomCode: string }
```

---

### `chooseActionTarget(data)`

Resolves a pending action card. Must be the drawer (`pendingAction.drawerId === you`).

```ts
{ roomCode: string; targetPlayerId: string }
```

`targetPlayerId` must be in `pendingAction.eligibleTargets`.

---

### `playAgain(data)`

Host only. Phase `ended` only. Resets the room to `lobby` with zeroed scores.

```ts
{ roomCode: string }
```

---

### `requestState(data)`

Resync: re-emits `roomUpdate` to the requesting socket only.

```ts
{ roomCode: string }
```

---

## Server → Client events

### `roomUpdate(view: RoomView)`

Broadcast to all connected players after every state change. Shape:

```ts
interface RoomView {
  code: string;
  ownerId: string | null;
  phase: 'lobby' | 'playing' | 'roundEnd' | 'ended';
  players: PlayerView[];           // all players, ordered by join time
  targetScore: number;
  currentRound: RoundView | null;
  roundHistory: RoundHistoryEntry[];
  winnerIds: string[];
}

interface PlayerView {
  id: string; name: string; totalScore: number; connected: boolean; isHost: boolean;
}

interface RoundView {
  roundNumber: number;
  currentTurnPlayerId: string | null;
  deckSize: number;          // draw pile card count (order NOT revealed)
  discardSize: number;       // discard pile count
  players: RoundPlayerView[];
  pendingAction: PendingActionView | null;
  roundEndReason: 'allDone' | 'flip7' | null;
  flip7PlayerId: string | null;
}

interface RoundPlayerView {
  playerId: string;
  status: 'active' | 'stayed' | 'busted';
  numberCards: number[];         // face-up — public to all players
  modifierAdds: number[];
  hasX2: boolean;
  hasSecondChance: boolean;
  flipThreeRemaining: number;
}

interface PendingActionView {
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  eligibleTargets: string[];
}

interface RoundHistoryEntry {
  roundNumber: number;
  scores: Record<string, number>;  // earned this round
  flip7PlayerId: string | null;
}
```

**Privacy:** `deck` and `discard` arrays are stripped — only `deckSize`/`discardSize` are sent.
`resumeToken` is never included in any broadcast.
