import { createRoom, deleteRoom, getRoom } from '../server/src/models/room';
import { getSocketIndex } from '../server/src/models/player';

describe('flip7 room model', () => {
  // F1 regression: getRoom's `code.toUpperCase()` previously threw for any
  // non-string `code` — reachable directly from every handler's unvalidated
  // `data.roomCode`, and reproduced live (in a sibling game) as a full
  // server-process crash during the codebase review.
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

  // F3 regression: deleteRoom previously left departed players' socket
  // index entries in place forever.
  describe('deleteRoom', () => {
    it('clears the socket index for every player in the room', () => {
      const { room, hostId } = createRoom('Host', 'socket-2', 'host-2');
      expect(getSocketIndex('socket-2')).toEqual({ roomCode: room.code, playerId: hostId });

      deleteRoom(room.code);

      expect(getSocketIndex('socket-2')).toBeUndefined();
    });
  });
});
