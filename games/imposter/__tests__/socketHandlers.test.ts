import type { Server } from 'socket.io';
import {
  clearAllParties,
  createParty as createPartySession,
  getPartyByActiveMatch,
} from '../../../apps/platform/server/party/partyStore';
import { registerGame } from '../server/src/handlers/socketHandlers';
import { deleteRoom, getRoom } from '../server/src/models/room';
import { deleteSocketIndex, getSocketIndex } from '../server/src/models/player';

vi.mock('../server/src/utils/wordLibrary', () => ({
  persistWord: vi.fn(),
  getGlobalWordLibrary: vi.fn(() => ['Existing']),
}));

vi.mock('nanoid', () => {
  let counter = 0;

  return {
    nanoid: (size?: number) => `id-${size ?? 0}-${++counter}`,
    customAlphabet: () => () => 'ABCD',
  };
});

type Handler = (...args: any[]) => void;

function createNamespace() {
  let connectionHandler: ((socket: any) => void) | undefined;
  const sockets = new Map<string, any>();

  return {
    use: vi.fn(),
    on: vi.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
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

function autoJoin(
  socket: ReturnType<typeof createSocket>,
  payload: {
    sessionId: string;
    playerId: string;
    name: string;
    resumeToken?: string;
    isHost?: boolean;
  }
) {
  if (!payload.joinToken) {
    payload.joinToken = ensurePartyMember(payload.sessionId, payload.playerId, payload.name);
  }
  const cb = vi.fn();
  socket.handlers.autoJoinRoom(payload, cb);
  return cb;
}

const partyTokensBySession = new Map();

function ensurePartyMember(sessionId, playerId, name) {
  let tokens = partyTokensBySession.get(sessionId);
  if (!tokens) {
    const { party, hostResumeToken } = createPartySession(playerId, name, 'party-socket');
    party.status = 'in-match';
    party.activeMatch = {
      gameId: 'imposter',
      matchKey: sessionId,
      namespace: '/g/imposter',
      startedAt: Date.now(),
    };
    tokens = { [playerId]: hostResumeToken };
    partyTokensBySession.set(sessionId, tokens);
    return hostResumeToken;
  }
  if (tokens[playerId]) return tokens[playerId];
  const token = 'token-' + sessionId + '-' + playerId;
  const party = getPartyByActiveMatch(sessionId, 'imposter');
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

describe('socketHandlers autoJoinRoom', () => {
  afterEach(() => {
    deleteSocketIndex('socket-1');
    deleteSocketIndex('socket-2');
    deleteSocketIndex('socket-3');
    deleteSocketIndex('socket-4');
    clearAllParties();
    partyTokensBySession.clear();
  });

  it('creates a room keyed by session and preserves the hub player id', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const socket = createSocket('socket-1');
    namespace.sockets.set(socket.id, socket);
    connectionHandler!(socket);

    const cb = autoJoin(socket, {
      sessionId: 'session-1',
      playerId: 'hub-player-1',
      name: 'Host',
    });

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        playerId: 'hub-player-1',
      })
    );

    const roomCode = cb.mock.calls[0]?.[0]?.roomCode as string;
    const room = getRoom(roomCode);
    expect(room).toBeDefined();
    expect(room?.players['hub-player-1']?.name).toBe('Host');

    deleteRoom(roomCode);
  });

  it('reconnects the same hub player to the mapped room', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const firstSocket = createSocket('socket-1');
    namespace.sockets.set(firstSocket.id, firstSocket);
    connectionHandler!(firstSocket);

    const firstCb = autoJoin(firstSocket, {
      sessionId: 'session-2',
      playerId: 'hub-player-2',
      name: 'Host',
    });

    const roomCode = firstCb.mock.calls[0]?.[0]?.roomCode as string;
    const resumeToken = firstCb.mock.calls[0]?.[0]?.resumeToken as string;

    const secondSocket = createSocket('socket-2');
    namespace.sockets.set(secondSocket.id, secondSocket);
    connectionHandler!(secondSocket);

    const reconnectCb = autoJoin(secondSocket, {
      sessionId: 'session-2',
      playerId: 'hub-player-2',
      name: 'Host',
      resumeToken,
    });

    expect(reconnectCb).toHaveBeenCalledWith({
      ok: true,
      roomCode,
      playerId: 'hub-player-2',
      resumeToken,
    });

    deleteRoom(roomCode);
  });

  it('restores the owner as host when they reconnect', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);

    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-owner-host',
      playerId: 'owner-1',
      name: 'Owner',
      isHost: true,
    });

    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;
    const ownerResumeToken = createCb.mock.calls[0]?.[0]?.resumeToken as string;

    const joinSocket = createSocket('socket-2');
    namespace.sockets.set(joinSocket.id, joinSocket);
    connectionHandler!(joinSocket);
    const joinCb = autoJoin(joinSocket, {
      sessionId: 'session-owner-host',
      playerId: 'guest-1',
      name: 'Guest',
    });
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    ownerSocket.handlers.disconnect();

    let room = getRoom(roomCode);
    expect(room?.hostId).toBe(guestPlayerId);

    const reconnectSocket = createSocket('socket-3');
    namespace.sockets.set(reconnectSocket.id, reconnectSocket);
    connectionHandler!(reconnectSocket);
    const resumeCb = vi.fn();
    reconnectSocket.handlers.resumePlayer(
      { roomCode, playerId: ownerPlayerId, resumeToken: ownerResumeToken },
      resumeCb
    );

    expect(resumeCb).toHaveBeenCalledWith({ ok: true });

    room = getRoom(roomCode);
    expect(room?.hostId).toBe(ownerPlayerId);
    expect(room?.players[ownerPlayerId]?.isHost).toBe(true);
    expect(room?.players[guestPlayerId]?.isHost).toBe(false);

    deleteRoom(roomCode);
  });

  it('removes a lobby player when they leave the room', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-leave-lobby',
      playerId: 'owner-2',
      name: 'Owner',
      isHost: true,
    });

    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = autoJoin(guestSocket, {
      sessionId: 'session-leave-lobby',
      playerId: 'guest-2',
      name: 'Guest',
    });
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const leaveCb = vi.fn();
    guestSocket.handlers.leaveRoom({ roomCode, playerId: guestPlayerId }, leaveCb);

    expect(leaveCb).toHaveBeenCalledWith({ ok: true });
    expect(guestSocket.join).toHaveBeenCalledWith(roomCode);
    expect(guestSocket.leave).toHaveBeenCalledWith(roomCode);

    const room = getRoom(roomCode);
    expect(room?.players[guestPlayerId]).toBeUndefined();

    deleteRoom(roomCode);
  });

  it('lets a player rejoin an active game by reclaiming their disconnected name', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-rejoin-active',
      playerId: 'owner-3',
      name: 'Owner',
      isHost: true,
    });
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = autoJoin(guestSocket, {
      sessionId: 'session-rejoin-active',
      playerId: 'guest-3',
      name: 'Jona',
    });
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const thirdSocket = createSocket('socket-4');
    namespace.sockets.set(thirdSocket.id, thirdSocket);
    connectionHandler!(thirdSocket);
    autoJoin(thirdSocket, {
      sessionId: 'session-rejoin-active',
      playerId: 'guest-4',
      name: 'Guest 2',
    });

    ownerSocket.handlers.startGame({ roomCode, playerId: ownerPlayerId }, vi.fn());

    const leaveCb = vi.fn();
    guestSocket.handlers.leaveRoom({ roomCode, playerId: guestPlayerId }, leaveCb);
    expect(leaveCb).toHaveBeenCalledWith({ ok: true });

    let room = getRoom(roomCode);
    expect(room?.players[guestPlayerId]?.connected).toBe(false);

    const rejoinSocket = createSocket('socket-3');
    namespace.sockets.set(rejoinSocket.id, rejoinSocket);
    connectionHandler!(rejoinSocket);
    const rejoinCb = autoJoin(rejoinSocket, {
      sessionId: 'session-rejoin-active',
      playerId: guestPlayerId,
      name: 'Jona',
      resumeToken: joinCb.mock.calls[0]?.[0]?.resumeToken as string,
    });

    expect(rejoinCb).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        playerId: guestPlayerId,
      })
    );

    room = getRoom(roomCode);
    expect(room?.players[guestPlayerId]?.connected).toBe(true);
    expect(room?.players[guestPlayerId]?.socketId).toBe('socket-3');

    deleteRoom(roomCode);
  });

  it('host can kick a player from the lobby', () => {
    const namespace = createNamespace();
    const io = {
      of: vi.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-kick-lobby',
      playerId: 'owner-4',
      name: 'Owner',
      isHost: true,
    });
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = autoJoin(guestSocket, {
      sessionId: 'session-kick-lobby',
      playerId: 'guest-5',
      name: 'Guest',
    });
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const kickCb = vi.fn();
    ownerSocket.handlers.kickPlayer(
      { roomCode, playerId: ownerPlayerId, targetId: guestPlayerId },
      kickCb
    );

    expect(kickCb).toHaveBeenCalledWith({ ok: true });
    expect(guestSocket.leave).toHaveBeenCalledWith(roomCode);
    expect(guestSocket.emit).toHaveBeenCalledWith('kicked', 'You were removed from the lobby');

    const room = getRoom(roomCode);
    expect(room?.players[guestPlayerId]).toBeUndefined();

    deleteRoom(roomCode);
  });

  // Client payloads are untrusted at runtime; invalid words must be rejected safely.
  it('submitWord rejects a non-string word instead of throwing', () => {
    const namespace = createNamespace();
    const io = { of: vi.fn(() => namespace) } as unknown as Server;
    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-submit-word',
      playerId: 'owner-word',
      name: 'Owner',
      isHost: true,
    });
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;

    const wordCb = vi.fn();
    expect(() =>
      ownerSocket.handlers.submitWord({ roomCode, playerId: ownerPlayerId, word: 12345 }, wordCb)
    ).not.toThrow();
    expect(wordCb).toHaveBeenCalledWith({ ok: false, error: 'Word must be text' });

    deleteRoom(roomCode);
  });

  // F3 regression: deleteRoom previously left the departed players' socket
  // index entries in place forever.
  it('deleteRoom clears the socket index for every player in the room', () => {
    const namespace = createNamespace();
    const io = { of: vi.fn(() => namespace) } as unknown as Server;
    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = autoJoin(ownerSocket, {
      sessionId: 'session-delete-room-index',
      playerId: 'owner-index',
      name: 'Owner',
      isHost: true,
    });
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;

    expect(getSocketIndex('socket-1')).toEqual({ roomCode, playerId: 'owner-index' });

    deleteRoom(roomCode);

    expect(getSocketIndex('socket-1')).toBeUndefined();
  });

  // Regression: submitVote/submitDescription previously had no rate limit,
  // unlike kritzelagent's submitStroke — a scripted client could flood
  // either at an arbitrary rate once connected. Rate limiting is checked
  // before any room/auth lookup, so a raw connected socket is enough to
  // exercise it.
  it('rate-limits rapid submitVote calls from the same socket', () => {
    const namespace = createNamespace();
    const io = { of: vi.fn(() => namespace) } as unknown as Server;
    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    const socket = createSocket('socket-flood-vote');
    namespace.sockets.set(socket.id, socket);
    connectionHandler!(socket);

    const responses: Array<{ ok: boolean; error?: string }> = [];
    for (let i = 0; i < 21; i += 1) {
      const cb = vi.fn();
      socket.handlers.submitVote({ roomCode: 'nonexistent', playerId: 'x', targetId: 'y' }, cb);
      responses.push(cb.mock.calls[0][0]);
    }

    expect(responses.slice(0, 20).every((r) => r.error === 'Unauthorized')).toBe(true);
    expect(responses[20]).toEqual({ ok: false, error: 'Too many requests — slow down' });
  });

  it('rate-limits rapid submitDescription calls from the same socket', () => {
    const namespace = createNamespace();
    const io = { of: vi.fn(() => namespace) } as unknown as Server;
    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    const socket = createSocket('socket-flood-desc');
    namespace.sockets.set(socket.id, socket);
    connectionHandler!(socket);

    const responses: Array<{ ok: boolean; error?: string }> = [];
    for (let i = 0; i < 21; i += 1) {
      const cb = vi.fn();
      socket.handlers.submitDescription(
        { roomCode: 'nonexistent', playerId: 'x', description: 'hi' },
        cb
      );
      responses.push(cb.mock.calls[0][0]);
    }

    expect(responses.slice(0, 20).every((r) => r.error === 'Unauthorized')).toBe(true);
    expect(responses[20]).toEqual({ ok: false, error: 'Too many requests — slow down' });
  });

  describe('discussion timer', () => {
    function startThreePlayerRound(sessionId: string) {
      const namespace = createNamespace();
      registerGame({ of: vi.fn(() => namespace) } as unknown as Server);
      const connectionHandler = namespace.getConnectionHandler()!;
      const sockets: Record<string, ReturnType<typeof createSocket>> = {};
      let roomCode = '';
      for (const [playerId, name] of [
        ['p1', 'Ann'],
        ['p2', 'Ben'],
        ['p3', 'Cat'],
      ] as const) {
        const socket = createSocket(`${sessionId}-${playerId}`);
        namespace.sockets.set(socket.id, socket);
        connectionHandler(socket);
        sockets[playerId] = socket;
        const cb = autoJoin(socket, { sessionId, playerId, name });
        roomCode = cb.mock.calls[0][0].roomCode;
      }
      const start = vi.fn();
      sockets.p1!.handlers.startGame({ roomCode, playerId: 'p1' }, start);
      expect(start).toHaveBeenCalledWith({ ok: true });
      const room = getRoom(roomCode)!;
      const order = [...room.descriptionOrder];
      for (const playerId of order.slice(0, -1)) {
        const cb = vi.fn();
        sockets[playerId]!.handlers.submitDescription(
          { roomCode, playerId, description: 'clue' },
          cb
        );
        expect(cb).toHaveBeenCalledWith({ ok: true });
      }
      return { room, sockets, lastDescriber: order[order.length - 1]! };
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('advances to voting when the last pending describer disconnects', () => {
      const { room, sockets, lastDescriber } = startThreePlayerRound('session-disc-1');

      sockets[lastDescriber]!.handlers.disconnect('transport close');

      expect(room.phase).toBe('discussion');
      expect(room.discussionEndsAt).not.toBeNull();
      vi.advanceTimersByTime(room.discussionDurationMs);
      expect(room.phase).toBe('voting');
      deleteRoom(room.code);
    });

    it('re-arms the discussion timer when a player returns after everyone dropped', () => {
      const { room, sockets } = startThreePlayerRound('session-disc-2');
      const last = room.descriptionOrder[room.descriptionOrder.length - 1]!;
      const cb = vi.fn();
      sockets[last]!.handlers.submitDescription(
        { roomCode: room.code, playerId: last, description: 'clue' },
        cb
      );
      expect(room.phase).toBe('discussion');

      for (const socket of Object.values(sockets)) socket.handlers.disconnect('transport close');
      vi.advanceTimersByTime(room.discussionDurationMs);
      expect(room.phase).toBe('discussion');

      const returning = sockets.p1!;
      const resume = vi.fn();
      returning.handlers.resumePlayer(
        {
          roomCode: room.code,
          playerId: 'p1',
          resumeToken: room.players.p1!.resumeToken,
        },
        resume
      );
      expect(resume).toHaveBeenCalledWith({ ok: true });
      vi.advanceTimersByTime(0);
      expect(room.phase).toBe('voting');
      deleteRoom(room.code);
    });
  });
});

describe('submitWord rate limit', () => {
  it('rejects the sixth submitWord from one socket within ten seconds', () => {
    const namespace = createNamespace();
    registerGame({ of: vi.fn(() => namespace) } as unknown as Server);
    const socket = createSocket('socket-flood-word');
    namespace.sockets.set(socket.id, socket);
    namespace.getConnectionHandler()!(socket);

    const responses: Array<{ ok: boolean; error?: string }> = [];
    for (let i = 0; i < 6; i += 1) {
      const cb = vi.fn();
      socket.handlers.submitWord({ roomCode: 'nonexistent', playerId: 'x', word: 'w' }, cb);
      responses.push(cb.mock.calls[0][0]);
    }

    expect(responses.slice(0, 5).every((r) => r.error === 'Unauthorized')).toBe(true);
    expect(responses[5]).toEqual({ ok: false, error: 'Too many requests — slow down' });
  });
});
