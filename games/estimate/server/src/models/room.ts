import { DEFAULT_TOTAL_ROUNDS, MAX_PLAYERS, MIN_PLAYERS } from '../../../core/src/constants';
import type { Phase, ServerRoom } from '../../../core/src/types';
import { createPlayer, clearSocketIndexesForRoom } from './player';

const roomsByCode = new Map<string, ServerRoom>();
const codeBySession = new Map<string, string>();
const codeByPlayer = new Map<string, string>();

/** Thrown by room mutations when capacity is exceeded. Public for tests. */
export class RoomFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomFullError';
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit I, O, 0, 1 to reduce confusion
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 4; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (roomsByCode.has(code));
  return code;
}

export interface CreateRoomOptions {
  matchKey: string;
  totalRounds?: number;
  /**
   * Optional explicit host player id. When provided, the auto-generated host
   * player is created with this id instead of a fresh nanoid. This lets the
   * socket handler bind the room to the platform's authoritative playerId so
   * reconnects and host-sync work without an extra rename.
   */
  hostPlayerId?: string;
}

export function createRoom(hostName: string, opts: CreateRoomOptions): ServerRoom {
  if (codeBySession.has(opts.matchKey)) {
    throw new Error(`Session ${opts.matchKey} already has a room`);
  }
  const code = generateRoomCode();
  const host = createPlayer(hostName, true, opts.hostPlayerId);
  const room: ServerRoom = {
    roomCode: code,
    matchKey: opts.matchKey,
    hostPlayerId: host.id,
    phase: 'lobby' as Phase,
    currentRound: 0,
    totalRounds: opts.totalRounds ?? DEFAULT_TOTAL_ROUNDS,
    question: null,
    players: [host],
    guesses: new Map(),
    scores: new Map(),
    displayRange: null,
  };
  roomsByCode.set(code, room);
  codeBySession.set(opts.matchKey, code);
  codeByPlayer.set(host.id, code);
  return room;
}

export function getRoomByCode(roomCode: string): ServerRoom | undefined {
  return roomsByCode.get(roomCode);
}

export function getRoomBySession(sessionId: string): ServerRoom | undefined {
  const code = codeBySession.get(sessionId);
  if (!code) return undefined;
  return roomsByCode.get(code);
}

export function getRoomByPlayerId(playerId: string): ServerRoom | undefined {
  const code = codeByPlayer.get(playerId);
  if (!code) return undefined;
  return roomsByCode.get(code);
}

export function attachPlayerToRoom(
  room: ServerRoom,
  playerName: string,
  playerId?: string
): {
  playerId: string;
  resumeToken: string;
} {
  if (room.players.length >= MAX_PLAYERS) {
    throw new RoomFullError(`Room ${room.roomCode} is full (max ${MAX_PLAYERS} players)`);
  }
  const player = createPlayer(playerName, false, playerId);
  room.players.push(player);
  room.scores.set(player.id, 0);
  codeByPlayer.set(player.id, room.roomCode);
  return { playerId: player.id, resumeToken: player.resumeToken };
}

export function detachPlayerFromRoom(room: ServerRoom, playerId: string): void {
  // Detach by id — used when the platform reports a player has left the
  // party (we should also drop their score so the scoreboard stays clean).
  room.players = room.players.filter((p) => p.id !== playerId);
  room.guesses.delete(playerId);
  room.scores.delete(playerId);
  codeByPlayer.delete(playerId);
}

export function findPlayer(room: ServerRoom, playerId: string) {
  return room.players.find((p) => p.id === playerId);
}

export function deleteRoomByCode(roomCode: string): void {
  const room = roomsByCode.get(roomCode);
  if (!room) return;
  for (const player of room.players) {
    codeByPlayer.delete(player.id);
  }
  codeBySession.delete(room.matchKey);
  clearSocketIndexesForRoom(roomCode);
  roomsByCode.delete(roomCode);
}

export function getMinPlayers(): number {
  return MIN_PLAYERS;
}

export function getMaxPlayers(): number {
  return MAX_PLAYERS;
}

/** Test-only: reset all in-memory state. */
export function __resetRoomStoreForTests(): void {
  roomsByCode.clear();
  codeBySession.clear();
  codeByPlayer.clear();
}

/** Test-only: list all rooms (for socket disconnect lookups). */
export function __listRoomsForTests(): ServerRoom[] {
  return Array.from(roomsByCode.values());
}
