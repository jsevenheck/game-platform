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
{
  ok: false;
  error: string;
}
```

### `startGame`

Host-only. Starts a lobby once enough connected players are present.

Payload:

```ts
{
  roomCode: string;
}
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

Official Scout action: take one card from either end of the current prior set, insert it anywhere in your row in either orientation, and optionally spend a Scout & Show token to immediately show cards.

Payload:

```ts
{
  roomCode: string;
  cardId: string; // must be the leftmost or rightmost prior-set card
  insertIndex: number; // 0..row.length, insert before this index
  flip?: boolean; // flip the scouted card before insertion
  thenPlay?: {
    startIndex: number;
    count: number;
  };
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
{
  roomCode: string;
}
```

Response:

```ts
{ ok: true } | { ok: false; error: string }
```

### `requestState`

Requests a fresh personalized `roomUpdate`. The acknowledgement callback is optional.

Payload:

```ts
{
  roomCode: string;
}
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
  roundScore: number;
  scoutTokens: number;
  scoutAndShowTokens: number;
  row: ScoutCard[] | null;
}

interface PlayedSetView {
  id: string;
  playerId: string;
  cards: ScoutCard[];
  kind: 'single' | 'set' | 'run';
  count: number;
  highCard: number;
  lowCard: number;
}

interface TrickView {
  trickNumber: number;
  leaderId: string;
  currentTurnPlayerId: string | null;
  scoutedPlayerIds: string[];
  plays: PlayedSetView[];
  currentPlay: PlayedSetView | null;
  priorSetOwnerId: string | null;
}

interface TrickHistoryEntry {
  trickNumber: number;
  winnerId: string;
  cardCount: number;
  points: number;
}

interface RoundHistoryEntry {
  roundNumber: number;
  endingPlayerId: string;
  reason: 'handEmpty' | 'allScouted';
  scores: Record<string, number>;
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
  roundHistory: RoundHistoryEntry[];
  roundNumber: number;
  totalRounds: number;
  winnerIds: string[];
  gameEndReason: 'handEmpty' | 'allScouted' | null;
}
```

## Official Scout rules implemented

- Player counts use the official deck setup: 3p removes all cards containing 10, 2p/4p remove 9/10, 5p uses the full 45-card deck.
- Players may flip their whole dealt row once before the round starts; row order cannot otherwise be rearranged.
- A show must use contiguous cards: a single, matching-number set, or ordered consecutive run (ascending or descending).
- Plays compare by official order: more cards, then matching set over run, then higher low card within the same kind.
- Showing against a prior set immediately takes that prior set as points; only the current prior set remains on the table.
- Scouting takes one end card from the current prior set, inserts it anywhere and in either orientation, and gives the prior-set owner a scout token in 3-5p.
- Scout & Show is supported via `thenPlay` and consumes the player's round token (three tokens in the 2p variant).
- Round score is taken cards + scout tokens - cards left in hand; an `allScouted` ending player takes no hand penalty.
- A game lasts `playerCount` rounds in production; ties share victory.

## Operational notes

Lifecycle logs cover room creation, join/resume, start, setup choice, play/pass, game end, and cleanup. Logs must never include resume tokens, invite codes, or hidden opponent row values.
