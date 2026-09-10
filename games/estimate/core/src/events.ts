import type { RoomView } from './types';

export interface ClientToServerEvents {
  startGame: (
    data: { roomCode: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  autoJoinRoom: (
    data: {
      sessionId: string;
      playerId?: string;
      joinToken?: string;
      resumeToken?: string;
    },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  syncAuthority: (
    data: { roomCode: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  submitGuess: (
    data: { roomCode: string; playerId?: string; guess: number },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  revealSolution: (
    data: { roomCode: string; playerId?: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  nextRound: (
    data: { roomCode: string; playerId?: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  restartGame: (
    data: { roomCode: string; playerId?: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (data: RoomView) => void;
  phaseChange: (data: { phase: RoomView['phase'] }) => void;
  error: (data: { message: string }) => void;
}
