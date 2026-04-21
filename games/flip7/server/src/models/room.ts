import type { Room } from '../../../core/src/types';
import {
  DEFAULT_TARGET_SCORE,
  ROOM_IDLE_TIMEOUT_MS,
  ROOM_ENDED_CLEANUP_MS,
} from '../../../core/src/constants';
import { createPlayer, setSocketIndex } from './player';

const rooms = new Map<string, Room>();
const sessionToRoom = new Map<string, string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
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
    ownerId: host.id,
    hostId: host.id,
    phase: 'lobby',
    players: { [host.id]: host },
    targetScore: DEFAULT_TARGET_SCORE,
    currentRound: null,
    roundHistory: [],
    winnerIds: [],
  };

  rooms.set(code, room);
  setSocketIndex(socketId, code, host.id);

  return { room, hostId: host.id, resumeToken: host.resumeToken };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string): void {
  clearRoomCleanup(code);
  rooms.delete(code);
  for (const [sessionId, mappedCode] of sessionToRoom.entries()) {
    if (mappedCode === code) {
      sessionToRoom.delete(sessionId);
    }
  }
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
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
  return { roomCount: rooms.size, connectedPlayers };
}

export function setSessionToRoom(sessionId: string, roomCode: string): void {
  sessionToRoom.set(sessionId, roomCode);
}

export function getSessionRoom(sessionId: string): string | undefined {
  return sessionToRoom.get(sessionId);
}

// ─── Cleanup timers ───────────────────────────────────────────────────────────

const roomTimers = new Map<string, NodeJS.Timeout>();

export function scheduleRoomCleanup(code: string, delayMs: number): void {
  clearRoomCleanup(code);
  roomTimers.set(
    code,
    setTimeout(() => {
      deleteRoom(code);
      roomTimers.delete(code);
    }, delayMs)
  );
}

export function clearRoomCleanup(code: string): void {
  const timer = roomTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    roomTimers.delete(code);
  }
}

// Global periodic cleanup (every 10 minutes)
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const cleanupInterval = setInterval(() => {
  for (const [code, room] of rooms) {
    const allDisconnected = Object.values(room.players).every((p) => !p.connected);
    if (room.phase === 'ended') {
      scheduleRoomCleanup(code, ROOM_ENDED_CLEANUP_MS);
    } else if (allDisconnected) {
      scheduleRoomCleanup(code, ROOM_IDLE_TIMEOUT_MS);
    }
  }
}, CLEANUP_INTERVAL_MS);

cleanupInterval.unref?.();
