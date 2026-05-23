import type { RoomView } from './types';

export interface AutoJoinRoomData {
  sessionId: string;
  name: string;
  playerId?: string;
  isHost?: boolean;
  resumeToken?: string;
}

export interface AutoJoinRoomResponse {
  ok: true;
  roomCode: string;
  playerId: string;
  resumeToken: string;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type BasicResponse = { ok: true } | ErrorResponse;

export interface ClientToServerEvents {
  autoJoinRoom: (
    data: AutoJoinRoomData,
    cb: (res: AutoJoinRoomResponse | ErrorResponse) => void
  ) => void;

  startGame: (data: { roomCode: string }, cb: (res: BasicResponse) => void) => void;

  flipRow: (data: { roomCode: string; flip: boolean }, cb: (res: BasicResponse) => void) => void;

  playCards: (
    data: { roomCode: string; startIndex: number; count: number },
    cb: (res: BasicResponse) => void
  ) => void;

  pass: (
    data: {
      roomCode: string;
      source: 'showPile' | 'table';
      side: 'left' | 'right';
      cardId?: string;
      fromPlayerId?: string;
    },
    cb: (res: BasicResponse) => void
  ) => void;

  playAgain: (data: { roomCode: string }, cb: (res: BasicResponse) => void) => void;

  requestState: (data: { roomCode: string }, cb?: (res: BasicResponse) => void) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (data: RoomView) => void;
}
