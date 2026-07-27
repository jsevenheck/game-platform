# Estimate Socket API

Namespace: `/g/estimate`

All client events use Socket.IO acknowledgements. Successful acknowledgement payloads always
include `ok: true`; rejected actions return `{ ok: false, error: string }`.

## Client → server events

### `autoJoinRoom`

> **Authorization:** The server validates `joinToken` against the active platform party
> member via `authorizePartyJoin` from `apps/platform/server/party/gameAuth.ts`. Host
> identity is derived from `party.hostPlayerId`, not from the client-supplied `isHost` flag.

Creates, joins, or resumes the room associated with the platform `sessionId`.

Payload:

```ts
{
  sessionId: string;
  name: string;
  playerId?: string;
  isHost?: boolean;
  joinToken?: string;
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

Error response (`{ ok: false, error: string }`) on:

- `'Not authorized for this match'` — missing / wrong `joinToken`, or `playerId` is not a
  party member of the active match
- `'Resume token required'` — a returning player must supply a `resumeToken` once the
  room has been created
- `'Invalid resume token'` — supplied `resumeToken` does not match the stored token
- `'Name already taken'` — another player already uses this name in the room
- `'Game already started'` — new joiner tries to enter after the game has begun
- `'Room is full'` — `room.players.length >= MAX_PLAYERS`

### `startGame`

Host-only. Starts the first round. The room must be in `lobby` and have at least
`MIN_PLAYERS` (2) connected players.

Payload:

```ts
{
  roomCode: string;
}
```

Response: `{ ok: true } | { ok: false, error: string }`. Errors:

- `'Only host can start'`
- `'Game already started'` (room is not in lobby)
- `'Not enough players'`

### `submitGuess`

Records or replaces the player's guess for the current round.

Payload:

```ts
{
  roomCode: string;
  playerId?: string; // optional; the server uses the socket binding when omitted
  guess: number;     // finite, |guess| <= GUESS_VALUE_LIMIT (1e9)
}
```

Response: `{ ok: true } | { ok: false, error: string }`. Errors:

- `'Invalid guess'` — NaN, Infinity, or out-of-range
- `'Not in room'` — socket is not bound to any player in the room
- `'Cannot guess in phase …'` — room is not in `guessing`
- `'Question not loaded'`

### `revealSolution`

Host-only. Reveals the solution for the current round. The room must be in
`allSubmitted`; a second reveal is rejected because the room is already in
`reveal`.

Payload:

```ts
{
  roomCode: string;
}
```

Response: `{ ok: true } | { ok: false, error: string }`. Errors:

- `'Only host can reveal'`
- `'Cannot reveal in phase …'`

### `nextRound`

Host-only. Advances to the next round. Finishes the game (`gameEnd`) once
`currentRound >= totalRounds`. The room must be in `reveal`.

Payload:

```ts
{
  roomCode: string;
}
```

Response: `{ ok: true } | { ok: false, error: string }`. Errors:

- `'Only host can advance'`
- `'Cannot advance in phase …'`

### `restartGame`

Host-only. Resets the room back to lobby (scores cleared, new questions drawn). Allowed in
`reveal` (early restart) or `gameEnd`.

Payload:

```ts
{
  roomCode: string;
}
```

Response: `{ ok: true } | { ok: false, error: string }`. Errors:

- `'Only host can restart'`
- `'Cannot restart in phase …'`

## Server → client events

### `roomUpdate`

Sent after every state transition. The payload is **public** — there are no hidden values
in estimate (every player's guess is meant to be seen by everyone once revealed).

```ts
interface Range {
  lo: number;
  hi: number;
}

interface Question {
  text: string; // answer is never included in RoomView
}

interface GuessEntry {
  playerId: string;
  guess: number;
}

interface PlayerView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  hasSubmitted: boolean;
}

interface ScoreEntry {
  playerId: string;
  name: string;
  points: number;
}

interface WinnerEntry {
  playerId: string;
  name: string;
}

interface RoomView {
  roomCode: string;
  phase: 'lobby' | 'guessing' | 'allSubmitted' | 'reveal' | 'gameEnd';
  currentRound: number;
  totalRounds: number;
  players: PlayerView[];
  guesses: GuessEntry[];
  scores: ScoreEntry[];
  winners: WinnerEntry[];
  question: Question | null;
  solution: number | null;
  displayRange: Range | null;
}
```

### `phaseChange`

Sent alongside `roomUpdate` on every transition. The platform adapter subscribes to this
and shows its replay overlay once `phase === 'gameEnd'`.

```ts
{
  phase: 'lobby' | 'guessing' | 'allSubmitted' | 'reveal' | 'gameEnd';
}
```

### `error`

Sent when the server encounters a non-action-specific error (rare; most errors flow back
via the ack callback).

```ts
{
  message: string;
}
```

## Operational notes

- Lifecycle logs cover room creation, join/resume, start, submit, reveal, next, restart,
  and cleanup. Logs must never include resume tokens, `joinToken` values, or names paired
  with playerIds beyond the platform-party identification.
- The server emits `phaseChange` alongside every `roomUpdate`; the platform adapter uses
  the `gameEnd` phase to show its replay / return-to-party overlay.
- The CSV question library is loaded once at server start (cached). Restart the server to
  pick up changes to `games/estimate/server/data/questions.csv`.
- E2E timer constants are halved (`GUESS_TIMER_MS = 2_000`) when `E2E_TESTS=1` is set in
  the environment, but the server never auto-submits — the timer is UI-only.
