import type { RoomView, StrokePoint } from './types';

export type ActionResponse = { ok: true } | { ok: false; error: string };
export type JoinResponse =
  | { ok: true; roomCode: string; playerId: string; resumeToken: string }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  autoJoinRoom: (
    data: {
      sessionId: string;
      playerId?: string;
      joinToken?: string;
      resumeToken?: string;
    },
    cb: (res: JoinResponse) => void
  ) => void;
  startGame: (data: { roomCode: string }, cb: (res: ActionResponse) => void) => void;
  syncAuthority: (data: { roomCode: string }, cb: (res: ActionResponse) => void) => void;
  submitStroke: (
    data: { roomCode: string; points: StrokePoint[] },
    cb: (res: ActionResponse) => void
  ) => void;
  submitVote: (
    data: { roomCode: string; targetPlayerId: string },
    cb: (res: ActionResponse) => void
  ) => void;
  submitAgentGuess: (
    data: { roomCode: string; guess: string },
    cb: (res: ActionResponse) => void
  ) => void;
  nextRound: (data: { roomCode: string }, cb: (res: ActionResponse) => void) => void;
  restartGame: (data: { roomCode: string }, cb: (res: ActionResponse) => void) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (data: RoomView) => void;
  privateAssignment: (data: { category: string; topic: string | null; isAgent: boolean }) => void;
  phaseChange: (data: { phase: RoomView['phase'] }) => void;
  error: (data: { message: string }) => void;
}
