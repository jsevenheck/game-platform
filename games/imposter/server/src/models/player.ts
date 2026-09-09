import { nanoid } from 'nanoid';
import type { Player } from '../../../core/src/types';

// Map from socket.id → { roomCode, playerId }
const socketIndex = new Map<string, { roomCode: string; playerId: string }>();

export function createPlayer(name: string, isHost: boolean, id = nanoid(8)): Player {
  return {
    id,
    name,
    resumeToken: nanoid(16),
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

/**
 * Remove every `socketIndex` entry pointing at `roomCode`. Called when a
 * room is deleted so a still-connected (or never-cleanly-disconnected)
 * socket's stale index entry can't outlive the room it referenced —
 * otherwise it accumulates indefinitely in this process-lifetime map.
 */
export function deleteSocketIndexesForRoom(roomCode: string): void {
  for (const [socketId, index] of socketIndex.entries()) {
    if (index.roomCode === roomCode) {
      socketIndex.delete(socketId);
    }
  }
}
