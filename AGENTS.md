# Agent Instructions — Game Platform Monorepo

## What this is

A single pnpm workspace monorepo. One platform app, three integrated games.

```
apps/platform/   ← the only production app (Express + Socket.IO server, Vue 3 client)
games/blackout/  ← internal source module (no standalone server/client)
games/imposter/  ← internal source module
games/secret-signals/ ← internal source module
```

## Key facts

- Games are **internal modules**, not standalone products. They have no own toolchain.
- The platform owns the full party lifecycle: create → join → launch game → replay / return to lobby.
- `matchKey` is the unique identifier per match, passed as `sessionId` to each game's `autoJoinRoom` handler.
- `@shared/*` in game UI code resolves to `games/{game}/core/src/` via Vite's context-sensitive alias (see `apps/platform/vite.config.ts`) and per-game `ui-vue/tsconfig.json`.

## Skills

Custom skills live in `.skills/`.

| Skill            | Trigger description                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `playwright-cli` | Browser automation — navigate, click, fill, screenshot via `playwright-cli` CLI                       |
| `pnpm`           | pnpm-specific commands, workspace config, catalogs, overrides, patches                                |
| `ui-ux-pro-max`  | UI/UX design intelligence — styles, palettes, font pairings, accessibility, Vue/React/Tailwind stacks |

## Commands (always run from workspace root)

```bash
pnpm install        # install all dependencies
pnpm dev            # start platform (server + client)
pnpm test           # run all unit tests (jest, all 3 games)
pnpm lint           # eslint across all source
pnpm format         # prettier across all source
pnpm typecheck      # tsc via apps/platform
pnpm test:e2e       # playwright (platform must be running)
```

## Structure

```
apps/platform/
  server/
    index.ts          ← Express + Socket.IO entry
    party/            ← party domain (types, store, handlers)
    registry/         ← game server module registry
  src/
    router/           ← Vue Router (/, /party/:code, /party/:code/game/:gameId)
    stores/           ← Pinia party store
    views/            ← HomeView, PartyView, GameView
    games/            ← client-side game registry (loadClient per game)

games/{game}/
  core/src/           ← domain types and shared logic
  server/src/         ← Socket.IO game server (registers on /g/{game} namespace)
  ui-vue/src/
    App.vue           ← game root component (supports embedded/platform mode)
    PlatformAdapter.vue ← wraps App.vue, adds platform overlay (replay / return)
```

## Integration contracts

Every game exposes:

- `register(io, namespacePath)` — registers Socket.IO handlers
- `cleanupMatch(matchKey)` — tears down a room by matchKey
- `autoJoinRoom` socket event — creates or rejoins a room for a given sessionId/matchKey

`PlatformGameProps` passed to each `PlatformAdapter.vue`:

```ts
{
  (matchKey, playerId, playerName, namespace, isHost, onReplayGame, onReturnToLobby);
}
```
