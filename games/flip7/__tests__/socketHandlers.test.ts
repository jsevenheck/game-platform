import type { Mock } from 'vitest';

vi.mock('../server/src/models/room', () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
  setSessionToRoom: vi.fn(),
  getSessionRoom: vi.fn(),
  clearRoomCleanup: vi.fn(),
  deleteRoom: vi.fn(),
  scheduleRoomCleanup: vi.fn(),
}));

vi.mock('../server/src/managers/broadcastManager', () => ({
  broadcastRoom: vi.fn(),
  sendRoomToPlayer: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id'),
}));

import type { Room } from '../core/src/types';
import { registerFlip7 } from '../server/src/socketHandlers';
import { createRoom, getRoom, setSessionToRoom, getSessionRoom } from '../server/src/models/room';
import { deleteSocketIndex, setSocketIndex } from '../server/src/models/player';

type HandlerMap = Record<string, (...args: unknown[]) => void>;

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
        totalScore: 0,
        connected: true,
        isHost: true,
        socketId,
      },
    },
    targetScore: 200,
    currentRound: null,
    roundHistory: [],
    winnerIds: [],
  };
}

function makeNamespace() {
  const middleware: Array<(socket: unknown, next: (err?: Error) => void) => void> = [];
  let connectionHandler: ((socket: unknown) => void) | undefined;

  const nsp = {
    use(fn: (socket: unknown, next: (err?: Error) => void) => void) {
      middleware.push(fn);
      return nsp;
    },
    on(event: string, handler: (socket: unknown) => void) {
      if (event === 'connection') connectionHandler = handler;
      return nsp;
    },
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets: new Map<string, { leave: Mock; disconnect: Mock }>(),
  };

  return {
    nsp,
    connect(socket: unknown) {
      for (const fn of middleware) fn(socket, () => {});
      connectionHandler?.(socket);
    },
  };
}

function makeSocket(id: string, auth?: Record<string, string>) {
  const handlers: HandlerMap = {};
  return {
    id,
    data: {} as Record<string, string>,
    handshake: { auth: auth ?? {} },
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers[event] = handler;
      return this;
    },
    off: vi.fn(),
    handlers,
  };
}

function makeIo(nsp: ReturnType<typeof makeNamespace>['nsp']) {
  return { of: vi.fn(() => nsp) };
}

describe('registerFlip7 — autoJoinRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new room when session is unknown', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-1');
    ns.connect(socket);

    const mockRoom = makeRoom('ABCD', 'player-1', 'socket-1');
    (getSessionRoom as Mock).mockReturnValue(undefined);
    (createRoom as Mock).mockReturnValue({
      room: mockRoom,
      hostId: 'player-1',
      resumeToken: 'token-abc',
    });

    const cb = vi.fn();
    socket.handlers['autoJoinRoom']?.(
      { sessionId: 'session-1', name: 'Host', playerId: 'player-1', isHost: true },
      cb
    );

    expect(createRoom).toHaveBeenCalledWith('Host', 'socket-1', 'player-1');
    expect(setSessionToRoom).toHaveBeenCalledWith('session-1', 'ABCD');
    expect(cb).toHaveBeenCalledWith({
      ok: true,
      roomCode: 'ABCD',
      playerId: 'player-1',
      resumeToken: 'token-abc',
    });
  });

  it('rejects with "Resume token required" when player exists but no token provided', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-2');
    ns.connect(socket);

    const room = makeRoom('ABCD', 'player-1', 'socket-old');
    (getSessionRoom as Mock).mockReturnValue('ABCD');
    (getRoom as Mock).mockReturnValue(room);

    const cb = vi.fn();
    socket.handlers['autoJoinRoom']?.(
      { sessionId: 'session-1', name: 'Host', playerId: 'player-1' },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Resume token required' });
  });

  it('rejects with "Invalid resume token" when wrong token is given', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-2');
    ns.connect(socket);

    const room = makeRoom('ABCD', 'player-1', 'socket-old');
    (getSessionRoom as Mock).mockReturnValue('ABCD');
    (getRoom as Mock).mockReturnValue(room);

    const cb = vi.fn();
    socket.handlers['autoJoinRoom']?.(
      { sessionId: 'session-1', name: 'Host', playerId: 'player-1', resumeToken: 'wrong-token' },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid resume token' });
  });

  it('rejoins with correct resume token', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-new');
    ns.nsp.sockets.set('socket-old', { leave: vi.fn(), disconnect: vi.fn() });
    ns.connect(socket);

    const room = makeRoom('ABCD', 'player-1', 'socket-old');
    setSocketIndex('socket-old', 'ABCD', 'player-1');
    (getSessionRoom as Mock).mockReturnValue('ABCD');
    (getRoom as Mock).mockReturnValue(room);

    const cb = vi.fn();
    socket.handlers['autoJoinRoom']?.(
      {
        sessionId: 'session-1',
        name: 'Host',
        playerId: 'player-1',
        resumeToken: 'resume-player-1',
      },
      cb
    );

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, roomCode: 'ABCD', playerId: 'player-1' })
    );
    deleteSocketIndex('socket-old');
  });

  it('rejects when name already taken in lobby', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-3');
    ns.connect(socket);

    const room = makeRoom('ABCD', 'player-1', 'socket-1', 'Alice');
    (getSessionRoom as Mock).mockReturnValue('ABCD');
    (getRoom as Mock).mockReturnValue(room);

    const cb = vi.fn();
    socket.handlers['autoJoinRoom']?.(
      { sessionId: 'session-1', name: 'Alice', playerId: 'player-2' },
      cb
    );

    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Name already taken' });
  });
});

describe('registerFlip7 — startGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects startGame if not host', () => {
    const ns = makeNamespace();
    const io = makeIo(ns.nsp);
    registerFlip7(io as never, '/g/flip7');

    const socket = makeSocket('socket-nothost');
    ns.connect(socket);

    const room = makeRoom('ABCD', 'player-host', 'socket-host');
    // Add enough players
    room.players['p2'] = { ...room.players['player-host'], id: 'p2', name: 'B', socketId: null };
    room.players['p3'] = { ...room.players['player-host'], id: 'p3', name: 'C', socketId: null };
    (getRoom as Mock).mockReturnValue(room);
    // socket-nothost is not indexed to this room
    // verifyIsHost will return false

    const cb = vi.fn();
    socket.handlers['startGame']?.({ roomCode: 'ABCD' }, cb);

    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can start' });
  });
});
