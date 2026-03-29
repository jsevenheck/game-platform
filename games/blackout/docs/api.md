# Blackout Socket.IO API

Namespace: `/g/blackout`

Blackout is platform-only. Players do not create or join rooms directly; the platform launches a
match and each client enters through `autoJoinRoom`.

## Client -> Server Events

All callback responses follow:

- success: `{ ok: true, ... }`
- error: `{ ok: false, error: string }`

### Session and Room Lifecycle

#### `autoJoinRoom`

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

- `sessionId` is the platform match key.
- When `isHost: true`, the server transfers the host role to this player.
- On first join for a given `playerId`, `resumeToken` is optional.
- When reclaiming an existing slot for that `playerId`, `resumeToken` must be present and valid.
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

Host only. Draws a new category/task (and letter if required by task). Can be used before or after
reveal.

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
- `usedCategoryIds: number[]` - IDs of categories used in completed rounds

Before reveal, non-host players receive:

- `currentRound.category = null`
- `currentRound.task = null`
- `currentRound.letter = null`

## Room Lifecycle

1. The platform launches a match and passes `matchKey` as `sessionId`.
2. Each player emits `autoJoinRoom` and is placed into the room mapped to that session.
3. Host can set rounds and room settings (`updateMaxRounds`, `updateRoomSettings`).
4. Host starts game (`startGame`).
5. Reload/reconnect uses `resumePlayer` plus the stored `resumeToken`.
6. Leave/disconnect updates player connectivity and host assignment.

## Gameplay Lifecycle

1. `startGame` creates the round and assigns the host as reader.
2. Host initially sees prompt: category + task + optional letter.
3. Host can optionally emit `rerollPrompt` before or after reveal.
4. Host emits `revealCategory`.
5. Players answer out loud.
6. Host emits `selectWinner`, or host/owner emits `skipRound`.
7. On `selectWinner`, winner gets a point and becomes the next host/reader.
8. Server finalizes round, updates scores, and transitions phase.
9. After `maxRounds`, phase transitions to `ended`.

## Error Handling

- Callback-based events return `{ ok: false, error }` on validation, permission, or state errors.
- Common error types:
  - room/player not found
  - invalid input
  - invalid resume token
  - host-only or owner-or-host violations
  - wrong game phase for requested action

Example:

```ts
{ ok: false, error: 'Room not found' }
```
