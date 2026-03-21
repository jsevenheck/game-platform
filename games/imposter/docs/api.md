# Imposter - Socket.IO API

Namespace: `/g/imposter`

## Authentication

The server maintains a `socketId -> { roomCode, playerId }` index.

All authenticated game actions verify that:

- the socket is registered for `data.roomCode`
- the socket is registered for `data.playerId`

If that mapping does not match, the event is rejected with:

```ts
{ ok: false, error: 'Unauthorized' }
```

The unauthenticated entry points are:

- `createRoom`
- `joinRoom`
- `autoJoinRoom`
- `resumePlayer`

## Client -> Server Events

All callback responses follow one of these shapes:

- success: `{ ok: true, ... }`
- error: `{ ok: false, error: string }`

### Session

#### `createRoom`

Creates a room and makes the creator both `owner` and current `host`.

```ts
createRoom(data: { name: string }, cb)
```

Success:

```ts
{
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}
```

#### `joinRoom`

```ts
joinRoom(data: { name: string; code: string }, cb)
```

Success:

```ts
{
  ok: true;
  playerId: string;
  resumeToken: string;
}
```

Notes:

- In lobby mode, duplicate names are rejected.
- In an active game, a disconnected player can reclaim their old slot by rejoining with the same room code and same player name.
- New players cannot join after the game has started.

#### `autoJoinRoom`

Platform embedding flow. The server maps `sessionId -> roomCode` and reuses the stable platform
`playerId` when reconnecting the same player.

```ts
autoJoinRoom(
  data: {
    sessionId: string;
    playerId: string;
    name: string;
    isHost?: boolean;
    resumeToken?: string;
  },
  cb
)
```

Success:

```ts
{
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}
```

Notes:

- When `isHost: true`, the server transfers host to this player.
- **First join** (no existing slot for `playerId`): `resumeToken` is not required.
- **Reconnect** (slot already exists): `resumeToken` must be present and valid. Missing or wrong token returns an error (`Resume token required` or `Invalid resume token`).

#### `resumePlayer`

Reconnects a stored session after reload or brief disconnect.

```ts
resumePlayer(data: { roomCode: string; playerId: string; resumeToken: string }, cb)
```

Success:

```ts
{
  ok: true;
}
```

#### `leaveRoom`

Leaves the current room.

```ts
leaveRoom(data: { roomCode: string; playerId: string }, cb)
```

Behavior:

- In `lobby` and `ended`, the player is removed from the room entirely.
- In an active round, the player becomes disconnected so they can reclaim the same slot later.

#### `requestState`

```ts
requestState(data: { roomCode: string; playerId: string })
```

Sends a fresh `roomState` to the requesting player only.

### Lobby

#### `configureLobby`

Host-only.

```ts
configureLobby(
  data: {
    roomCode: string;
    playerId: string;
    infiltratorCount: number;
    discussionDurationMs: number;
    targetScore: number;
  },
  cb
)
```

Notes:

- `infiltratorCount` may be `0` for paranoia mode.
- `discussionDurationMs` is server-validated in fixed steps.
- `targetScore` controls when the match ends.

#### `submitWord`

Any player can add a word to the shared global library.

```ts
submitWord(data: { roomCode: string; playerId: string; word: string }, cb)
```

New words are appended to `server/data/words.txt` when the file is writable.

#### `kickPlayer`

Host-only and lobby-only.

```ts
kickPlayer(
  data: { roomCode: string; playerId: string; targetId: string },
  cb
)
```

Notes:

- The host cannot kick themselves.
- The kicked player receives a `kicked` event and is returned to the landing screen.

#### `startGame`

Host-only.

```ts
startGame(data: { roomCode: string; playerId: string }, cb)
```

Requirements:

- at least 3 connected players
- `infiltratorCount < connectedPlayerCount`

### Description Phase

#### `submitDescription`

Players enter clues one at a time in the shared `descriptionOrder`.

```ts
submitDescription(
  data: { roomCode: string; playerId: string; description: string },
  cb
)
```

Rules:

- only the current `currentDescriberId` may submit
- max clue length is 30 characters
- once all connected turns are completed or skipped, the server transitions to `discussion`

#### `skipDescriptionTurn`

Host-only.

```ts
skipDescriptionTurn(data: { roomCode: string; playerId: string }, cb)
```

Behavior:

- marks the active clue as skipped
- advances to the next turn
- if it was the last turn, starts `discussion`

### Discussion Phase

The discussion timer is server-owned.

- default: 90 seconds
- E2E mode: 2 seconds
- actual duration is configurable in lobby via `discussionDurationMs`

When the timer expires, the server transitions to `voting`.

### Voting Phase

#### `submitVote`

```ts
submitVote(
  data: { roomCode: string; playerId: string; targetId: string },
  cb
)
```

Rules:

- self-votes are rejected
- one vote per connected player
- once all connected players have voted, votes are resolved automatically

### Reveal Phase

#### `guessWord`

Only caught infiltrators may guess.

```ts
guessWord(data: { roomCode: string; playerId: string; guess: string }, cb)
```

If all infiltrators were caught, a correct guess still gives the round to the infiltrators.

#### `skipGuess`

Host-only.

```ts
skipGuess(data: { roomCode: string; playerId: string }, cb)
```

Also fires automatically after the server timeout:

- normal runtime: 30 seconds
- E2E mode: 3 seconds

#### `nextRound`

Host-only.

```ts
nextRound(data: { roomCode: string; playerId: string }, cb)
```

Starts a fresh round without resetting scores.

#### `endGame`

Host-only.

```ts
endGame(data: { roomCode: string; playerId: string }, cb)
```

Moves directly to the final scoreboard (`ended`).

#### `restartGame`

Host-only.

```ts
restartGame(data: { roomCode: string; playerId: string }, cb)
```

Resets scores and returns to `lobby`.

## Server -> Client Events

### `roomState`

```ts
roomState(room: RoomView)
```

Per-player sanitized room view broadcast after every state change.

Important fields:

- `discussionDurationMs`
- `targetScore`
- `descriptionOrder`
- `currentDescriberId`
- `submittedDescriptionIds`
- `submittedVoteIds`
- `waitingForGuess`

Sanitization rules:

- `resumeToken` and `socketId` are never sent to clients
- `yourWord` is `null` for infiltrators until the final reveal/ended state
- `secretWord` is hidden while the game is still waiting for the infiltrator guess
- `infiltratorIds` are hidden until `reveal` or `ended`
- `descriptions` are visible from the description phase onward
- `votes` stay hidden until all connected votes are in, or until reveal/ended

### `kicked`

```ts
kicked(reason: string)
```

Sent only to a player removed from the lobby by the host.

## Error Handling

Common error strings include:

- `'Unauthorized'`
- `'Room not found'`
- `'Player not found'`
- `'Invalid resume token'`
- `'Name already taken'`
- `'Game already started'`
- `'Only host can configure'`
- `'Only host can skip clue turns'`
- `'Only host can kick players'`
- `'Can only kick players in the lobby'`
- `'Host cannot kick themselves'`
- `'Waiting for <name> to enter a clue'`
- `'Already submitted a description'`
- `'Already voted'`
- `'Cannot vote for yourself'`
- `'Only caught infiltrators can guess'`
