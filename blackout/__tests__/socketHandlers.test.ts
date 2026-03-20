jest.mock('../server/src/models/room', () => ({
  createRoom: jest.fn(),
  getRoom: jest.fn(),
  setSessionToRoom: jest.fn(),
  getSessionRoom: jest.fn(),
  clearRoomCleanup: jest.fn(),
  deleteRoom: jest.fn(),
}));

jest.mock('../server/src/managers/broadcastManager', () => ({
  broadcastRoom: jest.fn(),
  sendRoomToPlayer: jest.fn(),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id'),
}));

import type { Room } from '../core/src/types';
import { registerBlackout } from '../server/src/socketHandlers';
import {
  createRoom,
  getRoom,
  setSessionToRoom,
  getSessionRoom,
  clearRoomCleanup,
} from '../server/src/models/room';
import { broadcastRoom } from '../server/src/managers/broadcastManager';
import { deleteSocketIndex, getSocketIndex, setSocketIndex } from '../server/src/models/player';

type HandlerMap = Record<string, (...args: any[]) => void>;

function makeRoom(code: string, playerId: string, socketId: string, name = 'Host'): Room {
  return {
    code,
    ownerId: playerId,
    hostId: playerId,
    phase: 'lobby',
    players: {
      [playerId]: {
        id: playerId,
        name,
        resumeToken: `resume-${playerId}`,
        score: 0,
        connected: true,
        isHost: true,
        socketId,
      },
    },
    language: 'de',
    excludedLetters: ['Q', 'X', 'Y'],
    maxRounds: 10,
    currentRound: null,
    roundHistory: [],
    usedCategoryLetterPairs: new Set(),
  };
}

function makeNamespace() {
  const middleware: Array<(socket: any, next: (err?: Error) => void) => void> = [];
  let connectionHandler: ((socket: any) => void) | undefined;
  const nsp = {
    use(fn: (socket: any, next: (err?: Error) => void) => void) {
      middleware.push(fn);
      return nsp;
    },
    on(event: string, handler: (socket: any) => void) {
      if (event === 'connection') {
        connectionHandler = handler;
      }
      return nsp;
    },
    to: jest.fn(() => ({ emit: jest.fn() })),
    sockets: new Map<string, { leave: jest.Mock; disconnect: jest.Mock }>(),
  };

  return {
    nsp,
    connect(socket: any) {
      for (const fn of middleware) {
        fn(socket, () => undefined);
      }
      connectionHandler?.(socket);
    },
  };
}

function makeSocket(id: string, auth?: Record<string, string>) {
  const handlers: HandlerMap = {};
  return {
    id,
    data: {},
    handshake: { auth: auth ?? {} },
    join: jest.fn(),
    leave: jest.fn(),
    on(event: string, handler: (...args: any[]) => void) {
      handlers[event] = handler;
      return this;
    },
    handlers,
  };
}

describe('socketHandlers embedded autoJoinRoom', () => {
  afterEach(() => {
    jest.clearAllMocks();
    deleteSocketIndex('socket-old');
    deleteSocketIndex('socket-new');
    deleteSocketIndex('socket-host');
  });

  test('first autoJoinRoom creates a room using the hub player id as host id', () => {
    const room = makeRoom('ABCD', 'hub-1', 'socket-host');
    (getSessionRoom as jest.Mock).mockReturnValue(undefined);
    (createRoom as jest.Mock).mockImplementation(
      (_name: string, _socketId: string, hostPlayerId?: string) => ({
        room,
        hostId: hostPlayerId,
        resumeToken: room.players['hub-1'].resumeToken,
      })
    );

    const namespace = makeNamespace();
    registerBlackout({} as never, namespace.nsp as never);

    const socket = makeSocket('socket-host', { playerId: 'hub-1' });
    namespace.connect(socket);

    const cb = jest.fn();
    socket.handlers.autoJoinRoom({ sessionId: 'session-1', playerId: 'hub-1', name: 'Host' }, cb);

    expect(createRoom).toHaveBeenCalledWith('Host', 'socket-host', 'hub-1');
    expect(setSessionToRoom).toHaveBeenCalledWith('session-1', 'ABCD');
    expect(clearRoomCleanup).toHaveBeenCalledWith('ABCD');
    expect(cb).toHaveBeenCalledWith({
      ok: true,
      roomCode: 'ABCD',
      playerId: 'hub-1',
      resumeToken: room.players['hub-1'].resumeToken,
    });
  });

  test('second autoJoinRoom with same session and hub player reconnects to the same slot', () => {
    const room = makeRoom('ABCD', 'hub-1', 'socket-old', 'Embedded Tester');
    (getSessionRoom as jest.Mock).mockReturnValue('ABCD');
    (getRoom as jest.Mock).mockReturnValue(room);

    const namespace = makeNamespace();
    namespace.nsp.sockets.set('socket-old', {
      leave: jest.fn(),
      disconnect: jest.fn(),
    });
    setSocketIndex('socket-old', room.code, 'hub-1');

    registerBlackout({} as never, namespace.nsp as never);

    const socket = makeSocket('socket-new', { playerId: 'hub-1' });
    namespace.connect(socket);

    const cb = jest.fn();
    socket.handlers.autoJoinRoom(
      {
        sessionId: 'session-1',
        playerId: 'hub-1',
        name: 'Embedded Tester',
      },
      cb
    );

    expect(Object.keys(room.players)).toHaveLength(1);
    expect(room.players['hub-1'].socketId).toBe('socket-new');
    expect(room.players['hub-1'].connected).toBe(true);
    expect(namespace.nsp.sockets.get('socket-old')?.leave).toHaveBeenCalledWith('ABCD');
    expect(namespace.nsp.sockets.get('socket-old')?.disconnect).toHaveBeenCalledWith(true);
    expect(getSocketIndex('socket-old')).toBeUndefined();
    expect(getSocketIndex('socket-new')).toEqual({ roomCode: 'ABCD', playerId: 'hub-1' });
    expect(broadcastRoom).toHaveBeenCalledWith(namespace.nsp, room);
    expect(cb).toHaveBeenCalledWith({
      ok: true,
      roomCode: 'ABCD',
      playerId: 'hub-1',
      resumeToken: room.players['hub-1'].resumeToken,
    });
  });
});
