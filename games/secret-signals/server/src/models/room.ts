import { nanoid } from 'nanoid';
import { DEFAULT_ASSASSIN_PENALTY_MODE, getActiveTeamColors } from '../../../core/src/constants';
import type { Room } from '../../../core/src/types';
import { createPlayer, setSocketIndex } from './player';

const rooms = new Map<string, Room>();
const sessionToRoom = new Map<string, string>();
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function scheduleRoomCleanup(code: string): void {
  clearRoomCleanup(code);
  const timer = setTimeout(() => {
    deleteRoom(code);
  }, ROOM_CLEANUP_DELAY_MS);
  roomCleanupTimers.set(code, timer);
}

export function clearRoomCleanup(code: string): void {
  const timer = roomCleanupTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(code);
  }
}

export function createRoom(
  hostName: string,
  socketId: string,
  hostPlayerId?: string
): { room: Room; hostId: string; resumeToken: string } {
  const code = generateRoomCode();
  const host = createPlayer(hostName, true, hostPlayerId);
  host.socketId = socketId;

  const room: Room = {
    code,
    hostId: host.id,
    phase: 'lobby',
    players: { [host.id]: host },
    board: [],
    teams: [],
    currentTurnTeam: null,
    turnPhase: null,
    currentSignal: null,
    turnOrder: getActiveTeamColors(2),
    log: [],
    winnerTeam: null,
    winningTeams: [],
    teamCount: 2,
    assassinPenaltyMode: DEFAULT_ASSASSIN_PENALTY_MODE,
    focusedCards: [],
    nextStartingTeamIndex:
      process.env.E2E_TESTS === '1' ? 0 : Math.floor(Math.random() * getActiveTeamColors(2).length),
  };

  rooms.set(code, room);
  setSocketIndex(socketId, code, host.id);

  return { room, hostId: host.id, resumeToken: host.resumeToken };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function deleteRoom(code: string): void {
  clearRoomCleanup(code);
  rooms.delete(code);
  for (const [sessionId, roomCode] of sessionToRoom.entries()) {
    if (roomCode === code) {
      sessionToRoom.delete(sessionId);
    }
  }
}

export interface RoomStoreSnapshot {
  roomCount: number;
  connectedPlayers: number;
}

export function getRoomSnapshot(): RoomStoreSnapshot {
  let connectedPlayers = 0;

  for (const room of rooms.values()) {
    for (const player of Object.values(room.players)) {
      if (player.connected) {
        connectedPlayers += 1;
      }
    }
  }

  return {
    roomCount: rooms.size,
    connectedPlayers,
  };
}

export function setSessionToRoom(sessionId: string, roomCode: string): void {
  sessionToRoom.set(sessionId, roomCode);
}

export function getSessionRoom(sessionId: string): string | undefined {
  return sessionToRoom.get(sessionId);
}

export { scheduleRoomCleanup };
export { nanoid };
