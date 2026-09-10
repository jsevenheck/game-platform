import { nanoid } from 'nanoid';
import type { ServerPlayer } from '../../../core/src/types';

const socketIndex = new Map<string, { roomCode: string; playerId: string }>();

export function createPlayer(name: string, isHost: boolean, playerId?: string): ServerPlayer {
  return {
    id: playerId ?? nanoid(12),
    name,
    socketId: '',
    isHost,
    connected: true,
    resumeToken: nanoid(24),
    strokesSubmitted: 0,
    hasVoted: false,
  };
}

export function setSocketIndex(socketId: string, roomCode: string, playerId: string): void {
  socketIndex.set(socketId, { roomCode, playerId });
}

export function getSocketIndex(
  socketId: string
): { roomCode: string; playerId: string } | undefined {
  return socketIndex.get(socketId);
}

export function clearSocketIndex(socketId: string): void {
  socketIndex.delete(socketId);
}

export function clearSocketIndexesForRoom(roomCode: string): void {
  for (const [socketId, index] of socketIndex.entries()) {
    if (index.roomCode === roomCode) socketIndex.delete(socketId);
  }
}

export function __resetSocketIndexForTests(): void {
  socketIndex.clear();
}
