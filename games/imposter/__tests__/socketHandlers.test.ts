import type { Server } from 'socket.io';
import { registerGame } from '../server/src/handlers/socketHandlers';
import { deleteRoom, getRoom } from '../server/src/models/room';
import { deleteSocketIndex } from '../server/src/models/player';

jest.mock('nanoid', () => {
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
    use: jest.fn(),
    on: jest.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }),
    to: jest.fn(() => ({
      emit: jest.fn(),
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
    on: jest.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    handlers,
  };
}

describe('socketHandlers autoJoinRoom', () => {
  afterEach(() => {
    deleteSocketIndex('socket-1');
    deleteSocketIndex('socket-2');
    deleteSocketIndex('socket-3');
  });

  it('creates a room keyed by session and preserves the hub player id', () => {
    const namespace = createNamespace();
    const io = {
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const socket = createSocket('socket-1');
    namespace.sockets.set(socket.id, socket);
    connectionHandler!(socket);

    const cb = jest.fn();
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
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const firstSocket = createSocket('socket-1');
    namespace.sockets.set(firstSocket.id, firstSocket);
    connectionHandler!(firstSocket);

    const firstCb = jest.fn();
    firstSocket.handlers.autoJoinRoom(
      { sessionId: 'session-2', playerId: 'hub-player-2', name: 'Host' },
      firstCb
    );

    const roomCode = firstCb.mock.calls[0]?.[0]?.roomCode as string;
    const resumeToken = firstCb.mock.calls[0]?.[0]?.resumeToken as string;

    const secondSocket = createSocket('socket-2');
    namespace.sockets.set(secondSocket.id, secondSocket);
    connectionHandler!(secondSocket);

    const reconnectCb = jest.fn();
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
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);

    const createCb = jest.fn();
    ownerSocket.handlers.createRoom({ name: 'Owner' }, createCb);

    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;
    const ownerResumeToken = createCb.mock.calls[0]?.[0]?.resumeToken as string;

    const joinSocket = createSocket('socket-2');
    namespace.sockets.set(joinSocket.id, joinSocket);
    connectionHandler!(joinSocket);
    const joinCb = jest.fn();
    joinSocket.handlers.joinRoom({ name: 'Guest', code: roomCode }, joinCb);
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    ownerSocket.handlers.disconnect();

    let room = getRoom(roomCode);
    expect(room?.hostId).toBe(guestPlayerId);

    const reconnectSocket = createSocket('socket-3');
    namespace.sockets.set(reconnectSocket.id, reconnectSocket);
    connectionHandler!(reconnectSocket);
    const resumeCb = jest.fn();
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
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = jest.fn();
    ownerSocket.handlers.createRoom({ name: 'Owner' }, createCb);

    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = jest.fn();
    guestSocket.handlers.joinRoom({ name: 'Guest', code: roomCode }, joinCb);
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const leaveCb = jest.fn();
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
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = jest.fn();
    ownerSocket.handlers.createRoom({ name: 'Owner' }, createCb);
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = jest.fn();
    guestSocket.handlers.joinRoom({ name: 'Jona', code: roomCode }, joinCb);
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const thirdSocket = createSocket('socket-4');
    namespace.sockets.set(thirdSocket.id, thirdSocket);
    connectionHandler!(thirdSocket);
    thirdSocket.handlers.joinRoom({ name: 'Guest 2', code: roomCode }, jest.fn());

    ownerSocket.handlers.startGame({ roomCode, playerId: ownerPlayerId }, jest.fn());

    const leaveCb = jest.fn();
    guestSocket.handlers.leaveRoom({ roomCode, playerId: guestPlayerId }, leaveCb);
    expect(leaveCb).toHaveBeenCalledWith({ ok: true });

    let room = getRoom(roomCode);
    expect(room?.players[guestPlayerId]?.connected).toBe(false);

    const rejoinSocket = createSocket('socket-3');
    namespace.sockets.set(rejoinSocket.id, rejoinSocket);
    connectionHandler!(rejoinSocket);
    const rejoinCb = jest.fn();
    rejoinSocket.handlers.joinRoom({ name: 'Jona', code: roomCode }, rejoinCb);

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
      of: jest.fn(() => namespace),
    } as unknown as Server;

    registerGame(io);

    const connectionHandler = namespace.getConnectionHandler();
    expect(connectionHandler).toBeDefined();

    const ownerSocket = createSocket('socket-1');
    namespace.sockets.set(ownerSocket.id, ownerSocket);
    connectionHandler!(ownerSocket);
    const createCb = jest.fn();
    ownerSocket.handlers.createRoom({ name: 'Owner' }, createCb);
    const roomCode = createCb.mock.calls[0]?.[0]?.roomCode as string;
    const ownerPlayerId = createCb.mock.calls[0]?.[0]?.playerId as string;

    const guestSocket = createSocket('socket-2');
    namespace.sockets.set(guestSocket.id, guestSocket);
    connectionHandler!(guestSocket);
    const joinCb = jest.fn();
    guestSocket.handlers.joinRoom({ name: 'Guest', code: roomCode }, joinCb);
    const guestPlayerId = joinCb.mock.calls[0]?.[0]?.playerId as string;

    const kickCb = jest.fn();
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
