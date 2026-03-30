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
import { deleteSocketIndex } from '../server/src/models/player';

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
});
