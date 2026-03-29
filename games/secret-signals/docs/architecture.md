# Secret Signals Architecture

## Overview

Secret Signals is split into shared contracts, an authoritative Socket.IO server, and a
platform-launched Vue 3 client:

```text
core
  -> server
  -> ui-vue
```

Core design rules:

- the server owns the authoritative room state
- handlers stay thin and delegate gameplay logic to managers
- every client receives a per-player sanitized `RoomView`
- game flow moves through explicit room and turn phases
- gameplay scales from 2 to 8 teams on the same 5x5 board
- assassin resolution is configurable per room: `instant-loss` or `elimination`
- room entry is always platform-owned

## Shared core (`core/src`)

- `types.ts`: room, player, card, team, signal, log, and view models
- `events.ts`: typed Socket.IO event contracts
- `constants.ts`: board size, team colors, card distribution helpers, assassin modes, and
  validation limits

## Server (`server/src`)

### Models

- `models/room.ts`: in-memory room storage, `sessionId -> roomCode` mapping, and cleanup scheduling
- `models/player.ts`: player creation and socket-to-player lookup

### Managers

- `managers/boardManager.ts`: creates the 5x5 board and per-team card distribution
- `managers/turnManager.ts`: signal submission, guess outcomes, assassin handling, turn rotation,
  and win checks
- `managers/phaseManager.ts`: transitions between `lobby`, `playing`, and `ended`
- `managers/broadcastManager.ts`: room projection and per-player sanitization
- `data/words.ts`: shared bank of 800 curated German board words

### Socket handlers

`handlers/socketHandlers.ts` binds the `/g/secret-signals` namespace.

Handler responsibilities:

- validate `autoJoinRoom` / `resumePlayer`
- enforce host-only, self-service lobby, and role-based actions
- call managers for state transitions
- broadcast sanitized room state after each mutation

## Client (`ui-vue/src`)

### Store

`stores/game.ts` keeps local session data and the latest `RoomView`, then derives:

- current player and team
- host, Director, and Agent permissions
- whether the local player can signal, guess, or end the turn
- minimum players required for the configured team count
- local session persistence for resume after reload

### Components

- `Lobby.vue`: room view and host controls
- `TeamSetup.vue`: host-managed match settings plus self-service team and role assignment
- `GamePlay.vue`: active game layout, team roster rails, and reveal confirmation overlay
- `GameBoard.vue` and `CardCell.vue`: board rendering, shared card focus marker, and guesses
- `SignalInput.vue`: Director clue entry
- `TurnIndicator.vue`: current team, phase, and signal status
- `GameLog.vue`: completed turn history
- `GameOver.vue`: winner state, multi-winner endings, and replay action

### Socket layer

`composables/useSocket.ts` creates the typed Socket.IO connection to the Secret Signals namespace.
`App.vue` is platform-only: it auto-joins the match room, restores stored sessions with
`resumePlayer`, and keeps the local session in sync with the platform-launched game lifecycle.

If a player disconnects during an active match, they reclaim the same slot through
`autoJoinRoom` or `resumePlayer` with the stored `resumeToken`.

## State model

Room phases:

- `lobby`
- `playing`
- `ended`

Turn phases inside `playing`:

- `giving-signal`
- `guessing`

Typical flow:

1. The platform launches a match and all players auto-join the same room via `sessionId`.
2. Players enter the lobby, the host sets match options, and each player chooses their own team and
   role.
3. `startGame` validates connected players, rotates the opening team, and creates a new board plus
   team targets.
4. The active Director gives a signal.
5. The active Agents can mark multiple candidate cards for the whole room, then confirm a reveal
   locally from one of their own marks.
6. The active Agents reveal cards until they stop, miss, or exhaust the guess allowance.
7. The host can also force-skip a stalled turn, including the Director thinking phase.
8. Play rotates to the next active non-eliminated team.
9. The game ends when a team finds all of its target cards, only one team remains, or the assassin
   resolves the room immediately in `instant-loss` mode.

Important room state fields:

- `teamCount`: current active team count
- `turnOrder`: active team colors in play order
- `assassinPenaltyMode`: assassin resolution mode
- `winnerTeam`: first winner for convenience
- `winningTeams`: complete winner set for multi-team instant-loss endings
- `focusedCards`: shared per-player card markers during guessing

## Per-player sanitization

`broadcastManager` enforces visibility rules:

- internal player fields are stripped from all outgoing state
- Directors can see full card ownership during play
- Agents only see card ownership after reveal
- the full board is revealed for everyone once the match ends

## Platform Runtime

The game server module registers on `/g/secret-signals` via the platform game registry.
The platform (`apps/platform/`) owns party creation, joining, game launch, replay, and return to
lobby. Secret Signals only manages the in-match room state for the active platform session.
