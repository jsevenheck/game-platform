import type { RoomView } from './types';

export interface ClientToServerEvents {
  createRoom: (
    data: { name: string },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  joinRoom: (
    data: { name: string; code: string },
    cb: (
      res: { ok: true; playerId: string; resumeToken: string } | { ok: false; error: string }
    ) => void
  ) => void;
  autoJoinRoom: (
    data: { sessionId: string; playerId: string; name: string },
    cb: (
      res:
        | { ok: true; roomCode: string; playerId: string; resumeToken: string }
        | { ok: false; error: string }
    ) => void
  ) => void;
  resumePlayer: (
    data: { roomCode: string; playerId: string; resumeToken: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;
  leaveRoom: (data: { roomCode: string; playerId: string }) => void;

  updateMaxRounds: (data: { roomCode: string; playerId: string; maxRounds: number }) => void;
  updateRoomSettings: (data: {
    roomCode: string;
    playerId: string;
    language: 'de' | 'en';
    excludedLetters: string[];
  }) => void;
  startGame: (
    data: { roomCode: string; playerId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void
  ) => void;

  revealCategory: (data: { roomCode: string; playerId: string }) => void;
  rerollPrompt: (data: { roomCode: string; playerId: string }) => void;
  selectWinner: (data: { roomCode: string; playerId: string; winnerId: string }) => void;
  skipRound: (data: { roomCode: string; playerId: string }) => void;

  restartGame: (data: { roomCode: string; playerId: string }) => void;
  requestState: (data: { roomCode: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (room: RoomView) => void;
}
