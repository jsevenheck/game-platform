# Secret Signals Socket.IO API

Namespace: `/g/secret-signals`

All callback-based client events return one of:

- success: `{ ok: true, ... }`
- failure: `{ ok: false, error: string }`

Shared enums used below:

- `TeamColor`: `red | blue | green | orange | purple | teal | pink | gold`
- `PlayerRole`: `director | agent`
- `AssassinPenaltyMode`: `instant-loss | elimination`

## Client -> Server Events

### Session and room lifecycle

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

Behavior:

- when the room is joinable normally, a new player slot is created
- when a disconnected resumable slot with the same name already exists, the server reclaims that slot instead of creating a duplicate player
- this reclaim path also works while a game is already in progress

#### `autoJoinRoom`

Platform embedding flow. Creates or rejoins a room keyed by `sessionId` (the platform matchKey).

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

- When `isHost: true`, the server transfers the host role to this player.
- **First join** (no existing slot for `playerId`): `resumeToken` is not required.
- **Reconnect** (slot already exists): `resumeToken` must be present and valid. Missing or wrong token returns `{ ok: false, error: 'Resume token required' }` or `'Invalid resume token'`.

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

On success, the server rebinds that player slot to the new socket and broadcasts fresh room state.

#### `requestState`

```ts
requestState(data: { roomCode: string; playerId: string })
```

Sends a fresh `roomState` only to the requesting player.

#### `leaveRoom`

```ts
leaveRoom(data: { roomCode: string; playerId: string }, cb)
```

Clears the local session on success.

Behavior:

- in `lobby` and `ended`, the player is removed from the room immediately
- in `playing`, the player is treated as a voluntary disconnect and their slot remains resumable until cleanup

### Lobby setup

#### `setTeamCount`

```ts
setTeamCount(data: { roomCode: string; playerId: string; teamCount: number }, cb)
```

Host only. Valid team counts are `2` through `8`.

Notes:

- changing team count updates the active team color set
- players assigned to now-inactive team colors are cleared back to no team and no role
- if the room moves from `2` teams to more than `2` teams while still using the default assassin mode, the server switches the room to `elimination`

#### `setAssassinPenaltyMode`

```ts
setAssassinPenaltyMode(
  data: { roomCode: string; playerId: string; mode: 'instant-loss' | 'elimination' },
  cb
)
```

Host only, lobby only.

#### `assignTeam`

```ts
assignTeam(data: { roomCode: string; playerId: string; team: TeamColor }, cb)
```

Lobby only. Players choose their own team. Changing team clears that player's role.

#### `assignRole`

```ts
assignRole(data: { roomCode: string; playerId: string; role: 'director' | 'agent' }, cb)
```

Lobby only. Players choose their own role after joining a team.

Rules:

- each team must end up with exactly one Director and at least one Agent before the host can start
- a player cannot choose `director` if another connected player on that team is already the Director

#### `startGame`

```ts
startGame(data: { roomCode: string; playerId: string }, cb)
```

Host only.

Requirements:

- room is still in the lobby
- connected players count is at least `max(4, teamCount * 2)`
- every connected player has both a team and a role
- every active team has exactly one Director
- every active team has at least one Agent

Starter selection:

- the first game in a room picks a random starting team
- each later game rotates the starting team to the next active team

### Gameplay

#### `giveSignal`

```ts
giveSignal(
  data: { roomCode: string; playerId: string; word: string; number: number },
  cb
)
```

Director only, during the `giving-signal` turn phase. The signal word must be a single word and may not match an unrevealed board word.

#### `focusCard`

```ts
focusCard(data: { roomCode: string; playerId: string; cardIndex: number | null }, cb)
```

Agent only, during the `guessing` turn phase, and only for the active team.

Behavior:

- the first click adds an unrevealed card to that player's visible markers
- multiple players can mark multiple cards at the same time
- `cardIndex: null` clears that player's current markers
- markers on the revealed card are removed automatically when that card is revealed
- all remaining markers are cleared automatically when the turn advances or the game ends
- markers belonging to a disconnected player are removed automatically

#### `revealCard`

```ts
revealCard(
  data: { roomCode: string; playerId: string; cardIndex: number },
  cb
)
```

Agent only, during the `guessing` turn phase. Reveals the chosen board card and updates turn state, elimination state, and win conditions.

Client flow:

- agents typically call `focusCard` first to mark the candidate
- the reveal is only sent after a local confirmation step

Outcome details:

- revealing your own team card keeps the turn alive until the guess limit is reached or the team ends the turn
- revealing another team's card ends the turn immediately and counts toward that team's revealed progress
- revealing a neutral card ends the turn immediately
- revealing the assassin either ends the whole game (`instant-loss`) or eliminates the guessing team and continues (`elimination`)

#### `endTurn`

```ts
endTurn(data: { roomCode: string; playerId: string }, cb)
```

Agent only, during the `guessing` turn phase. Ends the current team's turn voluntarily.

#### `skipGuessRound`

```ts
skipGuessRound(data: { roomCode: string; playerId: string }, cb)
```

Host only, during an active turn. Forces the current team turn to end immediately and advances to the next active team.

#### `restartGame`

```ts
restartGame(data: { roomCode: string; playerId: string }, cb)
```

Host only. Returns the room to the lobby while keeping team assignments.

## Server -> Client Events

### `roomState`

```ts
roomState(room: RoomView)
```

Broadcast after every state change. The payload is sanitized per player:

- `resumeToken` and `socketId` are never exposed
- Directors can see hidden card types during play
- Agents only see types for revealed cards
- everyone sees full card types after the game ends
- board words are drawn from the shared German `WORD_LIST` in `server/src/data/words.ts`

Important `RoomView` fields:

- `teamCount`: active team count for the lobby and current match
- `assassinPenaltyMode`: current lobby or match setting
- `winnerTeam`: legacy convenience field set to the first winning team
- `winningTeams`: authoritative winner list, used for multi-team `instant-loss` endings
- `teams`: per-team target count, revealed count, and elimination state
- `focusedCards`: shared per-player marker list for currently considered unrevealed cards

## Error handling

Common failures include:

- room or player not found
- invalid room code, name, signal, or card index
- invalid phase for the requested action
- host-only or role-only permission checks
- trying to claim a Director seat that is already taken
- trying to mark or reveal outside the active guessing turn
- invalid team count, assassin mode, or role value
- invalid team setup before `startGame`
