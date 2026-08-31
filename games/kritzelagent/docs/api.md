# Kritzelagent Socket API

Namespace: `/g/kritzelagent`

All client actions use Socket.IO acknowledgements. Success is `{ ok: true }`;
rejections are `{ ok: false, error: string }`. Payloads are treated as
`unknown` at the handler boundary and validated before mutation.

## Client → server

### `autoJoinRoom`

```ts
{ sessionId: string; playerId?: string; joinToken?: string; resumeToken?: string }
```

The server authorizes the platform party member through
`apps/platform/server/party/gameAuth.ts`. The first room player uses the
platform-authoritative player ID. Existing players must provide the exact
resume token. The response is:

```ts
{
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}
```

### `startGame`

```ts
{
  roomCode: string;
}
```

Host-only. Requires at least five connected players.

### `submitStroke`

```ts
{ roomCode: string; points: StrokePoint[] }
```

The server derives the submitting player from the authorized socket binding;
any client-supplied identity is ignored. The sender must be the active drawing
player. The server accepts one normalized contiguous stroke of at most 80
finite points with coordinates in `[0, 1]`.

### `submitVote`

```ts
{
  roomCode: string;
  targetPlayerId: string;
}
```

The server derives the voter from the socket binding. One vote per eligible
connected player is accepted; self-votes and invalid targets are rejected.
Vote targets remain private until the vote quorum is complete.

### `submitAgentGuess`

```ts
{
  roomCode: string;
  guess: string;
}
```

Only the caught agent may submit a non-empty topic guess during `agentGuess`.
The server normalizes case and diacritics for matching.

### `nextRound`, `restartGame`, `syncAuthority`

Each takes `{ roomCode: string }`. `nextRound` and `restartGame` are host-only;
`syncAuthority` rechecks the active party and broadcasts the current sanitized
room view.

## Server → client

### `roomUpdate`

The public view contains players, accepted strokes, phase, category, vote
status, scores, and reveal data only when the phase permits it. Before reveal,
`agentId`, `topic`, and vote targets are absent or redacted. `revealedAgentId`
and `revealedTopic` become available only in `reveal` or `ended`.

### `privateAssignment`

Sent only to the authorized player's socket:

```ts
{
  category: string;
  topic: string | null;
  isAgent: boolean;
}
```

Artists receive the topic; the agent receives `topic: null`.

### `phaseChange` and `error`

```ts
{
  phase: Phase;
}
{
  message: string;
}
```

`phaseChange` accompanies each public room update. Expected action errors are
returned through the acknowledgement; unexpected failures are logged without
secrets and returned as a generic error.

## Security and operations

- Party authorization runs before room mutation and before every protected action.
- Host status is synchronized from the platform party, never trusted from a client prop.
- Metrics use bounded `namespace`, `game_id`, `event`, and `result` labels; player IDs, names, room codes, tokens, and raw payloads are not labels.
- Empty rooms are retained for 30 minutes for resume and then cleaned up.
