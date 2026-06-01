import { describe, expect, it } from 'vitest';
import { createRoom, deleteRoom } from '../server/src/models/room';
import { createPlayer, getSocketIndex, setSocketIndex } from '../server/src/models/player';

describe('Scout room model', () => {
  it('deletes socket indexes when deleting a room', () => {
    const { room } = createRoom('Alice', 'socket-a', 'a');
    const bob = createPlayer('Bob', false, 'b');
    bob.socketId = 'socket-b';
    room.players.b = bob;
    room.playerOrder.push('b');
    setSocketIndex('socket-b', room.code, bob.id);

    expect(getSocketIndex('socket-a')).toEqual({ roomCode: room.code, playerId: 'a' });
    expect(getSocketIndex('socket-b')).toEqual({ roomCode: room.code, playerId: 'b' });

    deleteRoom(room.code);

    expect(getSocketIndex('socket-a')).toBeUndefined();
    expect(getSocketIndex('socket-b')).toBeUndefined();
  });
});
