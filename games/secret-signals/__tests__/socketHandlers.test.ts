import type { Server } from 'socket.io';
import {
  clearAllParties,
  createParty as createPartySession,
  getPartyByActiveMatch,
} from '../../../apps/platform/server/party/partyStore';
import { registerGame } from '../server/src/handlers/socketHandlers';
import { deleteRoom, getRoom } from '../server/src/models/room';
import { deleteSocketIndex, getSocketIndex } from '../server/src/models/player';

vi.mock('nanoid', () => {
  let counter = 0;
  return {
    nanoid: (size?: number) => `id-${size ?? 0}-${++counter}`,
  };
});

type Handler = (...args: any[]) => void;

function createNamespace() {
  let connectionHandler: ((socket: any) => void) | undefined;
  const sockets = new Map<string, any>();

  return {
    use: vi.fn(),
    on: vi.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') connectionHandler = handler;
    }),
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets,
    getConnectionHandler: () => connectionHandler,
  };
}

function createSocket(id: string) {
  const handlers: Record<string, Handler> = {};
  return {
    id,
    data: {},
    handshake: { auth: {} },
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    handlers,
  };
}

const partyTokensBySession = new Map<string, Record<string, string>>();

function ensurePartyMember(sessionId: string, playerId: string, name: string): string {
  let tokens = partyTokensBySession.get(sessionId);
  if (!tokens) {
    const { party, hostResumeToken } = createPartySession(playerId, name, 'party-socket');
    party.status = 'in-match';
    party.activeMatch = {
      gameId: 'secret-signals',
      matchKey: sessionId,
      namespace: '/g/secret-signals',
      startedAt: Date.now(),
    };
    tokens = { [playerId]: hostResumeToken };
    partyTokensBySession.set(sessionId, tokens);
    return hostResumeToken;
  }
  if (tokens[playerId]) return tokens[playerId];
  const token = 'token-' + sessionId + '-' + playerId;
  const party = getPartyByActiveMatch(sessionId, 'secret-signals');
  if (party && !party.members.has(playerId)) {
    party.members.set(playerId, {
      playerId,
      name,
      connected: true,
      socketId: 'party-' + playerId,
      resumeToken: token,
    });
  }
  tokens[playerId] = token;
  return token;
}

function autoJoin(
  socket: ReturnType<typeof createSocket>,
  payload: { sessionId: string; playerId: string; name: string; resumeToken?: string }
) {
  const joinToken = ensurePartyMember(payload.sessionId, payload.playerId, payload.name);
  const cb = vi.fn();
  socket.handlers.autoJoinRoom({ ...payload, joinToken }, cb);
  return cb;
}

function setupGame() {
  const namespace = createNamespace();
  const io = { of: vi.fn(() => namespace) } as unknown as Server;
  registerGame(io);
  return { namespace, connectionHandler: namespace.getConnectionHandler()! };
}

describe('secret-signals socketHandlers', () => {
  afterEach(() => {
    for (const id of ['socket-1', 'socket-2', 'socket-3']) deleteSocketIndex(id);
    clearAllParties();
    partyTokensBySession.clear();
  });

  it('creates a room via autoJoinRoom and uses the authorized player id as host', () => {
    const { namespace, connectionHandler } = setupGame();
    const socket = createSocket('socket-1');
    namespace.sockets.set(socket.id, socket);
    connectionHandler(socket);

    const cb = autoJoin(socket, { sessionId: 'session-1', playerId: 'host-1', name: 'Host' });

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ ok: true, playerId: 'host-1' }));
    const roomCode = cb.mock.calls[0][0].roomCode as string;
    const room = getRoom(roomCode);
    expect(room?.hostId).toBe('host-1');
    expect(room?.players['host-1']?.name).toBe('Host');

    deleteRoom(roomCode);
  });

  it('rejects autoJoinRoom reconnect with a wrong resume token', () => {
    const { namespace, connectionHandler } = setupGame();
    const hostSocket = createSocket('socket-1');
    namespace.sockets.set(hostSocket.id, hostSocket);
    connectionHandler(hostSocket);
    const createCb = autoJoin(hostSocket, {
      sessionId: 'session-2',
      playerId: 'host-2',
      name: 'Host',
    });
    const roomCode = createCb.mock.calls[0][0].roomCode as string;

    const reconnectSocket = createSocket('socket-2');
    namespace.sockets.set(reconnectSocket.id, reconnectSocket);
    connectionHandler(reconnectSocket);
    const cb = autoJoin(reconnectSocket, {
      sessionId: 'session-2',
      playerId: 'host-2',
      name: 'Host',
      resumeToken: 'totally-wrong-token',
    });

    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid resume token' });
    deleteRoom(roomCode);
  });

  it('rejects setTeamCount from a non-host player', () => {
    const { namespace, connectionHandler } = setupGame();
    const hostSocket = createSocket('socket-1');
    namespace.sockets.set(hostSocket.id, hostSocket);
    connectionHandler(hostSocket);
    const createCb = autoJoin(hostSocket, {
      sessionId: 'session-3',
      playerId: 'host-3',
      name: 'Host',
    });
    const roomCode = createCb.mock.calls[0][0].roomCode as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler(guestSocket);
    autoJoin(guestSocket, { sessionId: 'session-3', playerId: 'guest-3', name: 'Guest' });

    const cb = vi.fn();
    guestSocket.handlers.setTeamCount({ roomCode, teamCount: 3 }, cb);
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can change' });

    deleteRoom(roomCode);
  });

  // F1 regression: giveSignal's `data.word?.trim().toUpperCase()` previously
  // crashed the entire server process when `word` was a non-string payload
  // value (the optional-chain only guards null/undefined, not a wrong type
  // such as a number) — this must now reject cleanly instead.
  it('giveSignal rejects a non-string word instead of throwing', () => {
    const { namespace, connectionHandler } = setupGame();
    const hostSocket = createSocket('socket-1');
    namespace.sockets.set(hostSocket.id, hostSocket);
    connectionHandler(hostSocket);
    const createCb = autoJoin(hostSocket, {
      sessionId: 'session-4',
      playerId: 'host-4',
      name: 'Host',
    });
    const roomCode = createCb.mock.calls[0][0].roomCode as string;

    // Force the room into a state where giveSignal's field-validation lines
    // are actually reached (playing / giving-signal / director's turn).
    const room = getRoom(roomCode)!;
    room.phase = 'playing';
    room.turnPhase = 'giving-signal';
    room.players['host-4'].team = room.turnOrder[0];
    room.players['host-4'].role = 'director';
    room.currentTurnTeam = room.turnOrder[0];

    const cb = vi.fn();
    expect(() =>
      hostSocket.handlers.giveSignal({ roomCode, word: 12345, number: 2 }, cb)
    ).not.toThrow();
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Signal must be a single word' });

    deleteRoom(roomCode);
  });

  // F1 regression: revealCard's numeric bounds check silently passes for a
  // non-numeric cardIndex (NaN comparisons are always false), reaching
  // `room.board[cardIndex].revealed` on `undefined` and crashing the
  // process — this must now reject cleanly instead.
  it('revealCard rejects a non-numeric cardIndex instead of throwing', () => {
    const { namespace, connectionHandler } = setupGame();
    const hostSocket = createSocket('socket-1');
    namespace.sockets.set(hostSocket.id, hostSocket);
    connectionHandler(hostSocket);
    const createCb = autoJoin(hostSocket, {
      sessionId: 'session-5',
      playerId: 'host-5',
      name: 'Host',
    });
    const roomCode = createCb.mock.calls[0][0].roomCode as string;

    const room = getRoom(roomCode)!;
    room.phase = 'playing';
    room.turnPhase = 'guessing';
    room.players['host-5'].team = room.turnOrder[0];
    room.players['host-5'].role = 'agent';
    room.currentTurnTeam = room.turnOrder[0];

    const cb = vi.fn();
    expect(() =>
      hostSocket.handlers.revealCard({ roomCode, cardIndex: 'not-a-number' }, cb)
    ).not.toThrow();
    expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid card index' });

    deleteRoom(roomCode);
  });

  // F3 regression: deleteRoom previously left departed players' socket
  // index entries in place forever.
  it('deleteRoom clears the socket index for every player in the room', () => {
    const { namespace, connectionHandler } = setupGame();
    const socket = createSocket('socket-1');
    namespace.sockets.set(socket.id, socket);
    connectionHandler(socket);
    const createCb = autoJoin(socket, {
      sessionId: 'session-6',
      playerId: 'host-6',
      name: 'Host',
    });
    const roomCode = createCb.mock.calls[0][0].roomCode as string;

    expect(getSocketIndex('socket-1')).toEqual({ roomCode, playerId: 'host-6' });

    deleteRoom(roomCode);

    expect(getSocketIndex('socket-1')).toBeUndefined();
  });
});
