import { DEFAULT_TOTAL_ROUNDS, MAX_PLAYERS, MIN_PLAYERS } from '../../../core/src/constants';
import type { Phase, ServerRoom } from '../../../core/src/types';
import { __resetSocketIndexForTests, clearSocketIndexesForRoom, createPlayer } from './player';

const roomsByCode = new Map<string, ServerRoom>();
const codeBySession = new Map<string, string>();
const codeByPlayer = new Map<string, string>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
      ''
    );
  } while (roomsByCode.has(code));
  return code;
}

export interface CreateRoomOptions {
  matchKey: string;
  totalRounds?: number;
  hostPlayerId?: string;
}

export function createRoom(hostName: string, options: CreateRoomOptions): ServerRoom {
  if (codeBySession.has(options.matchKey)) throw new Error('Session already has a room');
  const host = createPlayer(hostName, true, options.hostPlayerId);
  const room: ServerRoom = {
    roomCode: generateRoomCode(),
    matchKey: options.matchKey,
    hostPlayerId: host.id,
    phase: 'lobby' as Phase,
    currentRound: 0,
    totalRounds: options.totalRounds ?? DEFAULT_TOTAL_ROUNDS,
    prompt: null,
    promptDeck: [],
    players: [host],
    answers: new Map(),
    cows: new Map([[host.id, 0]]),
    pinkCowPlayerId: null,
    roundResult: null,
  };
  roomsByCode.set(room.roomCode, room);
  codeBySession.set(room.matchKey, room.roomCode);
  codeByPlayer.set(host.id, room.roomCode);
  return room;
}

export function getRoomByCode(roomCode: string): ServerRoom | undefined {
  return roomsByCode.get(roomCode);
}

export function getRoomBySession(sessionId: string): ServerRoom | undefined {
  const code = codeBySession.get(sessionId);
  return code ? roomsByCode.get(code) : undefined;
}

export function attachPlayerToRoom(room: ServerRoom, name: string, playerId?: string) {
  if (room.players.length >= MAX_PLAYERS) throw new RoomFullError('Room is full');
  const player = createPlayer(name, false, playerId);
  room.players.push(player);
  room.cows.set(player.id, 0);
  codeByPlayer.set(player.id, room.roomCode);
  return { playerId: player.id, resumeToken: player.resumeToken };
}

export function detachPlayerFromRoom(room: ServerRoom, playerId: string): void {
  room.players = room.players.filter((player) => player.id !== playerId);
  room.answers.delete(playerId);
  room.cows.delete(playerId);
  if (room.pinkCowPlayerId === playerId) room.pinkCowPlayerId = null;
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
  const timer = cleanupTimers.get(roomCode);
  if (timer) clearTimeout(timer);
  cleanupTimers.delete(roomCode);
}

export function scheduleRoomCleanup(roomCode: string, delayMs: number): void {
  clearRoomCleanup(roomCode);
  const timer = setTimeout(() => {
    cleanupTimers.delete(roomCode);
    deleteRoomByCode(roomCode);
  }, delayMs);
  timer.unref?.();
  cleanupTimers.set(roomCode, timer);
}

export function getMinPlayers(): number {
  return MIN_PLAYERS;
}
export function getMaxPlayers(): number {
  return MAX_PLAYERS;
}

export function __resetRoomStoreForTests(): void {
  for (const timer of cleanupTimers.values()) clearTimeout(timer);
  cleanupTimers.clear();
  roomsByCode.clear();
  codeBySession.clear();
  codeByPlayer.clear();
  __resetSocketIndexForTests();
}

export function __listRoomsForTests(): ServerRoom[] {
  return [...roomsByCode.values()];
}
