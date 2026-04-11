import { nanoid } from 'nanoid';
import type { Room } from '../../../core/src/types';
import { createPlayer } from './player';
import { setSocketIndex } from './player';
import { initGameState } from '../managers/gameManager';
import { DISCUSSION_DURATION_MS } from '../config/constants';

const rooms = new Map<string, Room>();
const sessionToRoom = new Map<string, string>();
// cleanup timers for empty rooms
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

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
    // Game-specific state initialized below
    infiltratorCount: 1,
    discussionDurationMs: 90_000,
    targetScore: 5,
    secretWord: null,
    infiltratorIds: [],
    descriptionOrder: [],
    descriptions: {},
    currentDescriberId: null,
    votes: {},
    roundNumber: 0,
    wordLibrary: [],
    discussionEndsAt: null,
    revealedInfiltrators: [],
    infiltratorGuess: null,
    waitingForGuess: false,
    lastRoundResult: null,
    roundHistory: [],
  };

  // Initialize with defaults from gameManager
  initGameState(room);
  room.discussionDurationMs = DISCUSSION_DURATION_MS;

  rooms.set(code, room);
  setSocketIndex(socketId, code, host.id);

  return { room, hostId: host.id, resumeToken: host.resumeToken };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function setHost(room: Room, nextHostId: string | null): void {
  room.hostId = nextHostId;
  for (const player of Object.values(room.players)) {
    player.isHost = player.id === nextHostId;
  }
}

export function deleteRoom(code: string): void {
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

// Re-export so socketHandlers doesn't need to import player separately
export { scheduleRoomCleanup };
export { nanoid };
