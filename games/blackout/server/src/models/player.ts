import { nanoid } from 'nanoid';
import type { Player } from '../../../core/src/types';

// Bidirectional socket index: socketId → { roomCode, playerId }
const socketIndex = new Map<string, { roomCode: string; playerId: string }>();

export function createPlayer(name: string, isHost: boolean, playerId?: string): Player {
  return {
    id: playerId ?? nanoid(12),
    name,
    resumeToken: nanoid(24),
    score: 0,
    connected: true,
    isHost,
    socketId: null,
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

export function deleteSocketIndex(socketId: string): void {
  socketIndex.delete(socketId);
}
