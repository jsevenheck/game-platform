import { DEFAULT_TOTAL_ROUNDS, MAX_PLAYERS, MIN_PLAYERS } from '../../../core/src/constants';
import type { Phase, ServerRoom } from '../../../core/src/types';
import { __resetSocketIndexForTests, clearSocketIndexesForRoom, createPlayer } from './player';

const roomsByCode = new Map<string, ServerRoom>();
const codeBySession = new Map<string, string>();
const codeByPlayer = new Map<string, string>();
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

export class RoomFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomFullError';
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = '';
    for (let index = 0; index < 4; index += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (roomsByCode.has(code));
  return code;
}

export interface CreateRoomOptions {
  matchKey: string;
  totalRounds?: number;
  hostPlayerId?: string;
}

export function createRoom(hostName: string, options: CreateRoomOptions): ServerRoom {
  if (codeBySession.has(options.matchKey)) {
    throw new Error(`Session ${options.matchKey} already has a room`);
  }
  const roomCode = generateRoomCode();
  const host = createPlayer(hostName, true, options.hostPlayerId);
  const room: ServerRoom = {
    roomCode,
    matchKey: options.matchKey,
    hostPlayerId: host.id,
    phase: 'lobby' as Phase,
    currentRound: 0,
    totalRounds: options.totalRounds ?? DEFAULT_TOTAL_ROUNDS,
    topic: null,
    topicDeck: [],
    agentId: null,
    players: [host],
    strokes: [],
    votes: new Map(),
    scores: new Map([[host.id, 0]]),
    roundResult: null,
    drawingOrder: [],
    drawingTurn: 0,
  };
  roomsByCode.set(roomCode, room);
  codeBySession.set(options.matchKey, roomCode);
  codeByPlayer.set(host.id, roomCode);
  return room;
}

export function getRoomByCode(roomCode: string): ServerRoom | undefined {
  return roomsByCode.get(roomCode);
}

export function getRoomBySession(sessionId: string): ServerRoom | undefined {
  const roomCode = codeBySession.get(sessionId);
  return roomCode ? roomsByCode.get(roomCode) : undefined;
}

export function getRoomByPlayerId(playerId: string): ServerRoom | undefined {
  const roomCode = codeByPlayer.get(playerId);
  return roomCode ? roomsByCode.get(roomCode) : undefined;
}

export function attachPlayerToRoom(
  room: ServerRoom,
  playerName: string,
  playerId?: string
): { playerId: string; resumeToken: string } {
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
  room.players = room.players.filter((player) => player.id !== playerId);
  room.votes.delete(playerId);
  room.scores.delete(playerId);
  room.strokes = room.strokes.filter((stroke) => stroke.playerId !== playerId);
  codeByPlayer.delete(playerId);
}

export function findPlayer(room: ServerRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

export function deleteRoomByCode(roomCode: string): void {
  const room = roomsByCode.get(roomCode);
  if (!room) return;
  for (const player of room.players) codeByPlayer.delete(player.id);
  codeBySession.delete(room.matchKey);
  clearRoomCleanup(roomCode);
  clearSocketIndexesForRoom(roomCode);
  roomsByCode.delete(roomCode);
}

export function clearRoomCleanup(roomCode: string): void {
  const timer = roomCleanupTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(roomCode);
  }
}

export function scheduleRoomCleanup(roomCode: string, delayMs: number): void {
  clearRoomCleanup(roomCode);
  const timer = setTimeout(() => {
    roomCleanupTimers.delete(roomCode);
    deleteRoomByCode(roomCode);
  }, delayMs);
  timer.unref?.();
  roomCleanupTimers.set(roomCode, timer);
}

export function getMinPlayers(): number {
  return MIN_PLAYERS;
}

export function getMaxPlayers(): number {
  return MAX_PLAYERS;
}

export function __resetRoomStoreForTests(): void {
  for (const timer of roomCleanupTimers.values()) clearTimeout(timer);
  roomCleanupTimers.clear();
  roomsByCode.clear();
  codeBySession.clear();
  codeByPlayer.clear();
  __resetSocketIndexForTests();
}

export function __listRoomsForTests(): ServerRoom[] {
  return [...roomsByCode.values()];
}
