# Scout Socket API

Namespace: `/g/scout`

All client events use Socket.IO acknowledgements. Successful acknowledgement payloads always include `ok: true`; rejected actions return `{ ok: false, error: string }`.

## Client → server events

### `autoJoinRoom`

Creates, joins, or resumes the room associated with the platform `sessionId`.

Payload:

```ts
{
  sessionId: string;
  name: string;
  playerId?: string;
  isHost?: boolean;
  resumeToken?: string;
}
```

Success response:

```ts
{
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}
```

Error response:

```ts
{ ok: false; error: string }
```

### `startGame`

Host-only. Starts a lobby once enough connected players are present.

Payload:

```ts
{ roomCode: string }
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `flipRow`

Confirms setup choice while the room is `playing` and the first trick has not started.

Payload:

```ts
{
  roomCode: string;
  flip: boolean;
}
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `playCards`

Plays a contiguous selection from the current player's row. The selection must be a valid Scout set or run and must beat the current play when one exists.

Payload:

```ts
{
  roomCode: string;
  startIndex: number;
  count: number;
}
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `pass`

Passes the current turn and scouts one card from either the show pile or the table.

Payload:

```ts
{
  roomCode: string;
  source: 'showPile' | 'table';
  side: 'left' | 'right';
  cardId?: string;
  fromPlayerId?: string;
}
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `playAgain`

Host-only. Resets an ended game back to the lobby.

Payload:

```ts
{ roomCode: string }
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `requestState`

Requests a fresh personalized `roomUpdate`. The acknowledgement callback is optional.

Payload:

```ts
{ roomCode: string }
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

## Server → client events

### `roomUpdate`

Sent after state changes and in response to `requestState`. The payload is personalized: only the recipient receives their own `row`; other players expose row counts only.

Payload:

```ts
interface ScoutCard {
  id: string;
  kind: 'scout';
  playValue: number;
  scoutPoints: number;
  flipped: boolean;
  color?: string;
}

interface PlayerView {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  rowCount: number;
  takenCount: number;
  setupConfirmed: boolean;
  score: number;
  row: ScoutCard[] | null;
}

interface PlayedSetView {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  /** Play strength: set value * count, or run high card * count. */
  sum: number;
  count: number;
  highCard: number;
}

interface TrickView {
  trickNumber: number;
  leaderId: string;
  currentTurnPlayerId: string | null;
  passedPlayerIds: string[];
  plays: PlayedSetView[];
  currentPlay: PlayedSetView | null;
}

interface TrickHistoryEntry {
  trickNumber: number;
  winnerId: string;
  cardCount: number;
  points: number;
}

interface RoomView {
  code: string;
  ownerId: string | null;
  phase: 'lobby' | 'playing' | 'ended';
  players: PlayerView[];
  playerOrder: string[];
  showPile: ScoutCard[];
  setupComplete: boolean;
  trick: TrickView | null;
  trickHistory: TrickHistoryEntry[];
  winnerIds: string[];
  gameEndReason: 'rowEmpty' | null;
}
```

## Play validation

- A set is 2+ cards with the same `playValue`; strength is `playValue * count`.
- A run is 3+ consecutive `playValue`s in the same card color/orientation; strength is `highest playValue * count`.
- A play must be a valid set or run. Plays compare by strength, then high card.

## Operational notes

Lifecycle logs cover room creation, join/resume, start, setup choice, play/pass, game end, and cleanup. Logs must never include resume tokens, invite codes, or hidden opponent row values.
