vi.mock('../server/src/managers/categoryManager', () => ({
  getDefaultExcludedLetters: vi.fn(() => ['Q', 'X', 'Y']),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id'),
}));

import {
  createRoom,
  deleteRoom,
  getSessionRoom,
  setSessionToRoom,
} from '../server/src/models/room';
import { deleteSocketIndex, getSocketIndex } from '../server/src/models/player';

describe('room model session mapping cleanup', () => {
  test('deleteRoom removes the embedded session to room mapping', () => {
    const sessionId = `session-${Date.now()}`;
    const { room } = createRoom('Host', 'socket-host', 'hub-host');

    setSessionToRoom(sessionId, room.code);
    expect(getSessionRoom(sessionId)).toBe(room.code);

    deleteRoom(room.code);
    deleteSocketIndex('socket-host');

    expect(getSessionRoom(sessionId)).toBeUndefined();
  });

  test('deleteRoom clears the socket index for every player in the room (F3 regression)', () => {
    const { room, hostId } = createRoom('Host', 'socket-host-2', 'hub-host-2');
    expect(getSocketIndex('socket-host-2')).toEqual({ roomCode: room.code, playerId: hostId });

    deleteRoom(room.code);

    expect(getSocketIndex('socket-host-2')).toBeUndefined();
  });
});
