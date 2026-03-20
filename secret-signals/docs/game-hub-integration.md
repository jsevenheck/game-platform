# Game Hub Integration

This document describes the Game Hub packaging surface that already exists in Secret Signals and how the repository sync is triggered.

## Overview

The `game-hub` platform uses an automated integration model:

- the hub owns the transformation process in its own repository
- games are auto-discovered by metadata and workflow input
- integration is triggered through GitHub Actions

## Synchronization workflow

When `.github/workflows/sync-to-hub.yml` runs, it triggers `receive-game-sync.yml` in the `jsevenheck/game-hub` repository with:

- `game-id=secret-signals`
- `source-ref=<current commit sha>`

## Required repository secret

The workflow expects:

- `GAME_SYNC_TOKEN`

That token needs `actions:write` permission for the `jsevenheck/game-hub` repository.

## Server adapter

`server/src/index.ts` exports:

- `definition`: game metadata (`id`, `name`, `minPlayers`, `maxPlayers`)
- `register`: namespace registration function
- `handler`: combined export used by the hub loader

The server namespace id is `/g/secret-signals`.

Current exported limits:

- `minPlayers: 4`
- `maxPlayers: 24`

Note: match start validation inside the game is stricter than the catalog minimum for higher team counts. The room requires `max(4, teamCount * 2)` connected players before `startGame` succeeds.

## Web library entry

`ui-vue/src/index.ts` exports:

- `manifest`: library metadata for the hub UI registry
- `GameComponent`: root Vue component
- shared `RoomView` and Socket.IO event types

The library entry uses named exports only. Consumers should import `GameComponent` rather than relying on a default export.

The current room payload exposed to the UI includes `teamCount`, `assassinPenaltyMode`, `winnerTeam`, and `winningTeams`, so hub-hosted clients can render the same lobby and end-state behavior as the standalone app.

## Integration props

`ui-vue/src/types/config.ts` defines the current integration prop surface:

| Prop          | Type     | Purpose                                   |
| ------------- | -------- | ----------------------------------------- |
| `sessionId`   | `string` | Optional external session identifier      |
| `joinToken`   | `string` | Optional auth token for host integration  |
| `wsNamespace` | `string` | Optional namespace override for embedding |
| `apiBaseUrl`  | `string` | Optional base URL for a remote server     |
| `playerId`    | `string` | Optional stable external player id        |
| `playerName`  | `string` | Optional externally supplied player name  |

## Notes

- the standalone app still uses the normal create/join room flow
- any deeper Game Hub-specific join/bootstrap flow should be documented here when it is implemented in code

## Checklist

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build:lib`.
2. Verify `GAME_SYNC_TOKEN` is configured.
3. Trigger `.github/workflows/sync-to-hub.yml` or merge to `main`.
4. Confirm the corresponding sync run starts in the `game-hub` repository.
