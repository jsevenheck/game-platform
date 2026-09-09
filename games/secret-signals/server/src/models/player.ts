import { nanoid } from 'nanoid';
import type { Player } from '../../../core/src/types';
import { createSocketIndex } from '../../../../../apps/platform/server/party/gameAuth';

// Factored into a shared helper (apps/platform/server/party/gameAuth.ts)
// since this was previously hand-rolled identically in every game — see
// that module's "Socket index helper" section for why.
const socketIndex = createSocketIndex();

export function createPlayer(name: string, isHost: boolean, stableId?: string): Player {
  return {
    id: stableId ?? nanoid(8),
    name,
    resumeToken: nanoid(16),
    score: 0,
    connected: true,
    isHost,
    socketId: null,
    team: null,
    role: null,
  };
}

export function setSocketIndex(socketId: string, roomCode: string, playerId: string): void {
  socketIndex.set(socketId, roomCode, playerId);
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
  socketIndex.deleteForRoom(roomCode);
}
