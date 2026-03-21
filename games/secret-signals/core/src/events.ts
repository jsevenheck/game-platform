import type { RoomView, TeamColor, PlayerRole, AssassinPenaltyMode } from './types';

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

  /** Reconnect with a previously stored session */
  resumePlayer: (
    data: { roomCode: string; playerId: string; resumeToken: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Request full room state (e.g. after reconnect) */
  requestState: (data: { roomCode: string; playerId: string }) => void;

  /** Leave the current room and clear the local session */
  leaveRoom: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Start the game (host only) */
  startGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Player assigns their own team (lobby only) */
  assignTeam: (
    data: { roomCode: string; playerId: string; team: TeamColor },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Player assigns their own role (lobby only) */
  assignRole: (
    data: { roomCode: string; playerId: string; role: PlayerRole },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host sets team count (lobby only) */
  setTeamCount: (
    data: { roomCode: string; playerId: string; teamCount: number },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host configures assassin behavior (lobby only) */
  setAssassinPenaltyMode: (
    data: { roomCode: string; playerId: string; mode: AssassinPenaltyMode },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Active agents mark a card for the team before confirming a reveal */
  focusCard: (
    data: { roomCode: string; playerId: string; cardIndex: number | null },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Director submits a signal/clue */
  giveSignal: (
    data: { roomCode: string; playerId: string; word: string; number: number },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Agent clicks a card to guess */
  revealCard: (
    data: { roomCode: string; playerId: string; cardIndex: number },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Agents voluntarily end their turn */
  endTurn: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host skips the current guessing round and advances to the next team */
  skipGuessRound: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Host restarts the game (goes back to lobby) */
  restartGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  /** Platform-driven auto-join: joins or creates a room for the given sessionId (matchKey) */
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
}

// ─── Server → Client ─────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Full room state broadcast to all players in the room */
  roomState: (room: RoomView) => void;
}
