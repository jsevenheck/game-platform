import { createRoom, deleteRoom, getRoom } from '../server/src/models/room';
import { getSocketIndex } from '../server/src/models/player';

describe('flip7 room model', () => {
  // Client payloads are untrusted at runtime; invalid room codes must be rejected safely.
  describe('getRoom', () => {
    it('returns undefined instead of throwing for a non-string code', () => {
      expect(() => getRoom(12345 as unknown as string)).not.toThrow();
      expect(getRoom(12345 as unknown as string)).toBeUndefined();

      expect(() => getRoom(null as unknown as string)).not.toThrow();
      expect(getRoom(undefined as unknown as string)).toBeUndefined();

      expect(() => getRoom({} as unknown as string)).not.toThrow();
      expect(getRoom([] as unknown as string)).toBeUndefined();
    });

    it('still resolves a real room case-insensitively', () => {
      const { room } = createRoom('Host', 'socket-1', 'host-1');
      expect(getRoom(room.code.toLowerCase())).toBe(room);
      deleteRoom(room.code);
    });
  });

  // Deleting a room must also remove all socket-index entries for that room.
  describe('deleteRoom', () => {
    it('clears the socket index for every player in the room', () => {
      const { room, hostId } = createRoom('Host', 'socket-2', 'host-2');
      expect(getSocketIndex('socket-2')).toEqual({ roomCode: room.code, playerId: hostId });

      deleteRoom(room.code);

      expect(getSocketIndex('socket-2')).toBeUndefined();
    });
  });
});
