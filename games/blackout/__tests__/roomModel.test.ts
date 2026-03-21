jest.mock('../server/src/managers/categoryManager', () => ({
  getDefaultExcludedLetters: jest.fn(() => ['Q', 'X', 'Y']),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id'),
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
