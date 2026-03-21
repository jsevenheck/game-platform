# Game Hub Integration

This document explains how the Blackout game integrates with the Game Hub platform.

## Overview

The `game-hub` platform uses an automated integration model for Blackout:

- The hub owns the code transformation process (`scripts/transform-game.mjs` in the hub repository).
- Games are auto-discovered — no manual registration in the platform files is required.
- Integration is fully automated via GitHub Actions using the `receive-game-sync.yml` workflow file in the `game-hub` repo.

## The Synchronization Process

Whenever changes are merged into the `main` branch of the Blackout repository, the `.github/workflows/sync-to-hub.yml` workflow is triggered.

This workflow:

1. Calls the `receive-game-sync.yml` workflow on the `game-hub` repository.
2. The hub repository checks out the Blackout source code.
3. The hub runs its internal transformer to adapt Blackout's source into the hub's structure.
4. A pull request is automatically opened in the `game-hub` repository with the integrated game.

### Integration Prerequisites

For the synchronization to work, the repository must have a secret configured:

- Name: `GAME_SYNC_TOKEN`
- Value: A Personal Access Token (or GitHub App token) with `actions:write` permission on the `jsevenheck/game-hub` repository.

## Hub Adapter Configuration

The game defines its entry points and configuration for the Game Hub environment using the following files:

### 1. Server Adapter (`server/src/index.ts`)

This file is the permanent hub adapter. It exports:

- `definition`: Game metadata (`id`, `name`, `minPlayers`, `maxPlayers`).
- `register`: The setup function which binds the game's `socketHandlers` to the provided Game Hub `Namespace`.
- `handler`: The combined interface expected by Game Hub.

### 2. Hub Dependencies (`hub.config.json`)

This configuration file at the repository root declares dependencies unique to the hub environment. For Blackout, this includes:

- `better-sqlite3`
- `nanoid`
- `@types/better-sqlite3`

### 3. Web UI Manifest (`ui-vue/src/index.ts`)

The library entry file exports:

- `manifest`: Matching the Game Hub UI expectations (`id`, `title`, `minPlayers`, `maxPlayers`).
- `GameComponent`: The root Vue component for the game.

## Local Development vs. Embedded (Game Hub)

### Embedded (Game Hub)

- `wsNamespace` is injected (`/g/blackout`).
- The standalone landing page is skipped.
- The client connects to the injected namespace and sends `sessionId`, `playerId`, and `joinToken` in the Socket.IO handshake auth.
- On connect, the client emits `autoJoinRoom({ sessionId, playerId, name })` and shows a retryable connecting state if the room does not load.
- The server resolves or creates a room via `sessionId -> roomCode` mapping.
- When `playerId` is present, the server uses it as the embedded player's stable in-game id so reconnects reuse the same player slot instead of creating duplicates.
- Repeated embedded joins for the same `sessionId` + `playerId` rebind the player to the new socket and disconnect the old socket if it still exists.
- Session mappings are removed when the mapped room is deleted.

### Standalone

- `wsNamespace` is undefined.
- The client uses `createRoom` / `joinRoom` from the standard landing UI.
- Room code sharing is done by players directly.
