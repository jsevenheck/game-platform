# Kritzelagent Architecture

Kritzelagent is a drop-in game module. The platform owns party membership and
launching; the game owns only its authoritative room state after the platform
has authorized a socket.

## State machine

```text
lobby ──► drawing ──► voting ──► agentGuess ──► reveal ──► drawing
                                  │                         └─► ended
                                  └───────────────(agent not caught)─► reveal
```

- **`lobby`** — authorized players join; the synchronized platform host starts.
- **`drawing`** — category is public, private assignments carry the topic/role,
  and only the server-selected active player may submit a stroke.
- **`voting`** — the shared canvas is public; connected eligible players vote.
- **`agentGuess`** — only a caught agent can submit a topic guess.
- **`reveal`** — the server publishes the role, topic, votes, outcome, and score delta.
- **`ended`** — final scores remain available to the platform adapter.

## Server modules

| Module                         | Responsibility                                        |
| ------------------------------ | ----------------------------------------------------- |
| `models/player.ts`             | player creation, resume tokens, socket index          |
| `models/room.ts`               | in-memory room store, room lookup, cleanup            |
| `managers/roundManager.ts`     | authoritative phases, turn order, quorum, mutations   |
| `managers/broadcastManager.ts` | sanitized public view and private assignment delivery |
| `managers/scoreManager.ts`     | pure vote-leader and score calculation                |
| `utils/topicLibrary.ts`        | CSV parsing, caching, fallback, no-repeat selection   |
| `socketHandlers.ts`            | authorization, host gating, metrics, lifecycle logs   |

All public serialization passes through `broadcastManager`. Secret topic and
agent identity are never placed in a pre-reveal `RoomView`.

## Ownership and reconnects

The platform party authorizes `(gameId, matchKey, playerId, joinToken)` before
the game room is created or changed. The first player is created with the
platform player ID, avoiding a fresh-ID mismatch on reconnect. A resume binds a
new socket to the existing authorized player, disconnects the superseded
transport, and restores the private assignment through the new socket.

Disconnecting players are marked unavailable, their socket index is removed,
and the drawing/vote quorum is recalculated from connected eligible players. If
voting becomes complete after a disconnect, the game resolves immediately. A
caught agent who disconnects during `agentGuess` is treated as a missed guess.
When all game sockets disconnect, a 30-minute cleanup timer is scheduled.

## Drawing validation

Clients send normalized points rather than SVG or image data. The pure
`normalizeStroke` helper rejects malformed arrays, non-finite coordinates,
out-of-range coordinates, and strokes above the 80-point limit. This keeps the
wire payload bounded and makes the canvas transport independent of rendering.

## Platform integration

The module is wired through the client/server registries, Vite shared aliases,
platform type declarations, design tokens, Vitest project list, root test
script, and Docker package-manifest copies. The build asset script copies the
CSV into the production server output.
