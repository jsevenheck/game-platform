import type { Server } from 'socket.io';
import { registerGame } from '../server/src/handlers/socketHandlers';
import { deleteRoom, getRoom } from '../server/src/models/room';
import { deleteSocketIndex } from '../server/src/models/player';

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
  const cb = vi.fn();
  socket.handlers.autoJoinRoom(payload, cb);
  return cb;
}

describe('socketHandlers autoJoinRoom', () => {
  afterEach(() => {
    deleteSocketIndex('socket-1');
    deleteSocketIndex('socket-2');
    deleteSocketIndex('socket-3');
    deleteSocketIndex('socket-4');
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

    const cb = vi.fn();
    socket.handlers.autoJoinRoom(
      { sessionId: 'session-1', playerId: 'hub-player-1', name: 'Host' },
      cb
    );

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

    const firstCb = vi.fn();
    firstSocket.handlers.autoJoinRoom(
      { sessionId: 'session-2', playerId: 'hub-player-2', name: 'Host' },
      firstCb
    );

    const roomCode = firstCb.mock.calls[0]?.[0]?.roomCode as string;
    const resumeToken = firstCb.mock.calls[0]?.[0]?.resumeToken as string;

    const secondSocket = createSocket('socket-2');
    namespace.sockets.set(secondSocket.id, secondSocket);
    connectionHandler!(secondSocket);

    const reconnectCb = vi.fn();
    secondSocket.handlers.autoJoinRoom(
      { sessionId: 'session-2', playerId: 'hub-player-2', name: 'Host', resumeToken },
      reconnectCb
    );

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
});
