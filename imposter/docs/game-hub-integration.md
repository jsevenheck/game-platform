# Game Hub Integration

This document describes the current embedded integration for `imposter`.

## Overview

The repository supports two modes:

- standalone mode
- embedded Game Hub mode

The embedded mode is implemented in the shared Vue root component and the shared
Socket.IO server, so the same repo can be used both standalone and inside the hub.

## Server Adapter

The Game Hub consumes the server through:

- `server/src/index.ts`
  exports game metadata and the namespace registration function

The server supports:

- `autoJoinRoom`
- stable hub `playerId` reuse
- `sessionId -> roomCode` mapping

## UI Library Export

The Game Hub consumes the UI through:

- `ui-vue/src/index.ts`

Exports:

- `manifest`
- `GameComponent`

The root component accepts the integration props defined in:

- `ui-vue/src/types/config.ts`

## Embedded Flow

Embedded mode is active when `wsNamespace` is provided.

Expected props:

| Prop | Type | Purpose |
| --- | --- | --- |
| `sessionId` | `string` | Hub party/session identifier |
| `playerId` | `string` | Stable hub player identifier |
| `playerName` | `string` | Display name used in the game |
| `joinToken` | `string` | Optional auth token from the hub |
| `wsNamespace` | `string` | Namespace override such as `/g/imposter` |
| `apiBaseUrl` | `string` | Optional server base URL override |

Embedded behavior:

1. the landing screen is skipped
2. the client creates a socket using the injected namespace
3. the client explicitly calls `socket.connect()` when needed
4. on connect, the client emits `autoJoinRoom({ sessionId, playerId, name })`
5. the server resolves or creates the mapped room
6. the server reuses the stable hub player ID on reconnect

## Why `socket.connect()` Is Explicit

Inside Game Hub, another namespace may already have created a shared Socket.IO manager.
That manager is not guaranteed to auto-connect new game namespaces.

Because of that, embedded mode must explicitly connect:

```ts
if (socket.connected) {
  emitAutoJoinRoom();
} else {
  socket.connect();
}
```

Without the explicit connect, the game can remain stuck in a permanent connecting state.

## Embedded Retry Guard

The client includes a retry guard:

- it retries `autoJoinRoom` shortly after mount if no room state has been received yet

This covers missed initial ack/state cases during first embedded connection.

## Standalone Differences

Standalone mode uses:

- `createRoom`
- `joinRoom`
- `resumePlayer`

Standalone-specific notes:

- local storage is used for `playerId`, `roomCode`, `resumeToken`, and `name`
- active standalone games support reclaiming a disconnected slot by rejoining with the same name

## Hub Sync

The synchronization flow still depends on the upstream Game Hub workflow:

1. merge to `main`
2. the sync workflow triggers
3. Game Hub checks out this repo
4. the hub transformer integrates the game
5. a PR is opened in the Game Hub repository

Required repository secret:

- `GAME_SYNC_TOKEN`

## Local Verification Checklist

Before syncing to Game Hub, verify:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e`
5. `pnpm run build:lib`
