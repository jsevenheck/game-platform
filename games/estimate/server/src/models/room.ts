// Stub for Phase 0 — full store is added in Phase 2.
import type { ServerRoom } from '../../../core/src/types';

const roomsByCode = new Map<string, ServerRoom>();
const codeBySession = new Map<string, string>();

export function setRoom(room: ServerRoom): void {
  roomsByCode.set(room.roomCode, room);
  codeBySession.set(room.matchKey, room.roomCode);
}

export function getRoomByCode(roomCode: string): ServerRoom | undefined {
  return roomsByCode.get(roomCode);
}

export function getRoomBySession(sessionId: string): ServerRoom | undefined {
  const code = codeBySession.get(sessionId);
  if (!code) return undefined;
  return roomsByCode.get(code);
}

export function deleteRoomByCode(roomCode: string): void {
  const room = roomsByCode.get(roomCode);
  if (room) codeBySession.delete(room.matchKey);
  roomsByCode.delete(roomCode);
}
