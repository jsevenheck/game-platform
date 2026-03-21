import type { RoomView } from './types';

// ─── Client → Server ─────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Create a new room and become host */
  createRoom: (
    data: { name: string },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;

  /** Join an existing room by code */
  joinRoom: (
    data: { name: string; code: string },
    cb: (
      res: { ok: true; playerId: string; resumeToken: string } | { ok: false; error: string }
    ) => void
  ) => void;

  /** Embedded mode: auto-create or rejoin a room keyed by platform session */
  autoJoinRoom: (
    data: {
      sessionId: string;
      playerId: string;
      name: string;
      isHost?: boolean;
      resumeToken?: string;
    },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;

  /** Reconnect with a previously stored session */
  resumePlayer: (
    data: { roomCode: string; playerId: string; resumeToken: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Leave the current room and clear the local session */
  leaveRoom: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Request full room state (e.g. after reconnect) */
  requestState: (data: { roomCode: string; playerId: string }) => void;

  /** Start the game (host only) */
  startGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  // ── Game-specific events ──────────────────────────────────────────────────

  /** Host configures lobby settings (infiltrator count) */
  configureLobby: (
    data: {
      roomCode: string;
      playerId: string;
      infiltratorCount: number;
      discussionDurationMs: number;
      targetScore: number;
    },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Player submits a word to the game library */
  submitWord: (
    data: { roomCode: string; playerId: string; word: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host removes a player from the lobby */
  kickPlayer: (
    data: { roomCode: string; playerId: string; targetId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Player submits their description during the description phase */
  submitDescription: (
    data: { roomCode: string; playerId: string; description: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host skips the current clue turn during description phase */
  skipDescriptionTurn: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Player casts a vote during the voting phase */
  submitVote: (
    data: { roomCode: string; playerId: string; targetId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Infiltrator guesses the secret word after being caught */
  guessWord: (
    data: { roomCode: string; playerId: string; guess: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host advances from reveal to next round or ends game */
  nextRound: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host restarts the game (returns to lobby) */
  restartGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host ends the game and moves to the final scoreboard (ended phase) */
  endGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host skips the infiltrator's word-guess opportunity */
  skipGuess: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Per-player sanitized room state broadcast */
  roomState: (room: RoomView) => void;

  /** The player was removed from the lobby by the host */
  kicked: (reason: string) => void;
}
