# Blackout Socket.IO API

Namespace: `/g/blackout`

## Client -> Server Events

All callback responses follow:

- success: `{ ok: true, ... }`
- error: `{ ok: false, error: string }`

### Lobby and Session

#### `createRoom`

```ts
createRoom(data: { name: string }, cb)
```

Response:

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

Response:

```ts
{
  ok: true;
  playerId: string;
  resumeToken: string;
}
```

Can be used while a game is already running (late join), as long as the room exists.

#### `autoJoinRoom`

```ts
autoJoinRoom(data: { sessionId: string; playerId: string; name: string }, cb)
```

Response:

```ts
{
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}
```

Notes:

- In embedded mode, a stable hub `playerId` is used directly as the in-game player id when provided.
- Repeating `autoJoinRoom` with the same `sessionId` and `playerId` reconnects the same player instead of creating a duplicate entry.
- `sessionId -> roomCode` mappings are in-memory and are cleaned up when a room is deleted.

#### `resumePlayer`

```ts
resumePlayer(data: { roomCode: string; playerId: string; resumeToken: string }, cb)
```

Response:

```ts
{
  ok: true;
}
```

#### `leaveRoom`

```ts
leaveRoom(data: { roomCode: string; playerId: string })
```

No callback.

### Host Config (Lobby)

#### `updateMaxRounds`

```ts
updateMaxRounds(data: { roomCode: string; playerId: string; maxRounds: number })
```

No callback. Host only, lobby phase only.

#### `updateRoomSettings`

```ts
updateRoomSettings(data: {
  roomCode: string;
  playerId: string;
  language: 'de' | 'en';
  excludedLetters: string[];
})
```

No callback. Host only, lobby phase only.

#### `startGame`

```ts
startGame(data: { roomCode: string; playerId: string }, cb)
```

Response:

```ts
{
  ok: true;
}
```

### Gameplay

#### `revealCategory`

```ts
revealCategory(data: { roomCode: string; playerId: string })
```

Host only. Reveals prompt to all players.

#### `rerollPrompt`

```ts
rerollPrompt(data: { roomCode: string; playerId: string })
```

Host only. Draws a new category/task (and letter if required by task). Can be used before or after reveal.

#### `selectWinner`

```ts
selectWinner(data: { roomCode: string; playerId: string; winnerId: string })
```

Host only. After reveal only. `winnerId` must be a connected, non-host player in the current room.

#### `skipRound`

```ts
skipRound(data: { roomCode: string; playerId: string })
```

Host or owner only. Finalizes round without winner.

### Meta

#### `restartGame`

```ts
restartGame(data: { roomCode: string; playerId: string })
```

Host only. Resets scores and returns room to lobby.

#### `requestState`

```ts
requestState(data: { roomCode: string; playerId: string })
```

Sends a `roomUpdate` to that specific player if valid.

## Server -> Client Events

### `roomUpdate`

```ts
roomUpdate(room: RoomView)
```

Per-player sanitized room state.

Important fields in current `RoomView`:

- `language: 'de' | 'en'`
- `excludedLetters: string[]`
- `currentRound.task`
- `currentRound.letter` (`string | null`)
- `usedCategoryIds: number[]` — IDs of categories used in completed rounds (for duplicate detection)

Before reveal, non-host players receive:

- `currentRound.category = null`
- `currentRound.task = null`
- `currentRound.letter = null`

## Room Lifecycle

1. Player creates/joins room (`createRoom`/`joinRoom`) or embedded auto-joins (`autoJoinRoom`).
2. Host can set rounds and room settings (`updateMaxRounds`, `updateRoomSettings`).
3. Host starts game (`startGame`).
4. Reconnect uses `resumePlayer` + `resumeToken`.
5. Leave/disconnect updates player connectivity and host assignment.

## Gameplay Lifecycle

1. `startGame` creates round and assigns host as reader.
2. Host initially sees prompt: category + task + optional letter.
3. Host can optionally emit `rerollPrompt` (before or after reveal).
4. Host emits `revealCategory`.
5. Players answer out loud.
6. Host emits `selectWinner` (winner must be connected); host or owner can emit `skipRound`.
7. On `selectWinner`, winner gets a point and becomes the next host/reader.
8. Server finalizes round, updates scores, transitions phase.
9. After `maxRounds`, phase transitions to `ended`.

## Error Handling

- Callback-based events return `{ ok: false, error }` on validation/permission/state errors.
- Common error types:
  - room/player not found
  - invalid input
  - invalid resume token
  - host-only / owner-or-host violations
  - wrong game phase for requested action

Example:

```ts
{ ok: false, error: 'Room not found' }
```
