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

export interface ActionResolvedEvent {
  drawerId: string;
  action: 'freeze' | 'flipThree' | 'secondChance';
  targetId: string;
}

export interface ClientToServerEvents {
  autoJoinRoom: (
    data: AutoJoinRoomData,
    cb: (res: AutoJoinRoomResponse | ErrorResponse) => void
  ) => void;

  setTargetScore: (data: { roomCode: string; targetScore: number }) => void;

  startGame: (data: { roomCode: string }, cb: (res: { ok: true } | ErrorResponse) => void) => void;

  hit: (data: { roomCode: string }) => void;

  stay: (data: { roomCode: string }) => void;

  chooseActionTarget: (data: { roomCode: string; targetPlayerId: string }) => void;

  playAgain: (data: { roomCode: string }) => void;

  requestState: (data: { roomCode: string }) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (data: RoomView) => void;
  actionResolved: (data: ActionResolvedEvent) => void;
}
