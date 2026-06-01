import type { Mock } from 'vitest';
import type { PartySession } from '../../../apps/platform/server/party/types';
import { clearAllParties, createParty } from '../../../apps/platform/server/party/partyStore';
import { registerScout } from '../server/src/socketHandlers';
import { deleteRoom, getAllRooms, getRoom } from '../server/src/models/room';

interface TestSocket {
  id: string;
  data: Record<string, string>;
  handshake: { auth: Record<string, string> };
  join: Mock;
  leave: Mock;
  disconnect: Mock;
  emit: Mock;
  on: (event: string, handler: (...args: unknown[]) => void) => TestSocket;
  off: Mock;
  handlers: Record<string, (...args: unknown[]) => void>;
}

function makeNamespace() {
  const middleware: Array<(socket: TestSocket, next: (err?: Error) => void) => void> = [];
  let connectionHandler: ((socket: TestSocket) => void) | undefined;

  const nsp = {
    use(fn: (socket: TestSocket, next: (err?: Error) => void) => void) {
      middleware.push(fn);
      return nsp;
    },
    on(event: string, handler: (socket: TestSocket) => void) {
      if (event === 'connection') connectionHandler = handler;
      return nsp;
    },
    to: vi.fn(() => ({ emit: vi.fn() })),
    sockets: new Map<string, TestSocket>(),
  };

  return {
    nsp,
    connect(socket: TestSocket) {
      nsp.sockets.set(socket.id, socket);
      for (const fn of middleware) fn(socket, () => {});
      connectionHandler?.(socket);
    },
  };
}

function makeSocket(id: string, auth?: Record<string, string>): TestSocket {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const socket: TestSocket = {
    id,
    data: {},
    handshake: { auth: auth ?? {} },
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers[event] = handler;
      return socket;
    },
    off: vi.fn(),
    handlers,
  };
  return socket;
}

function makeIo(nsp: ReturnType<typeof makeNamespace>['nsp']) {
  return { of: vi.fn(() => nsp) };
}

function setupScoutServer() {
  const ns = makeNamespace();
  const io = makeIo(ns.nsp);
  registerScout(io as never, '/g/scout');
  return ns;
}

function setupParty(matchKey = 'match-scout'): {
  party: PartySession;
  tokens: Record<string, string>;
} {
  const { party, hostResumeToken } = createParty('host', 'Host', 'party-host-socket');
  party.members.set('guest', {
    playerId: 'guest',
    name: 'Guest',
    connected: true,
    socketId: 'party-guest-socket',
    resumeToken: 'party-token-guest',
  });
  party.status = 'in-match';
  party.activeMatch = {
    gameId: 'scout',
    matchKey,
    namespace: '/g/scout',
    startedAt: Date.now(),
  };
  return { party, tokens: { host: hostResumeToken, guest: 'party-token-guest' } };
}

function autoJoin(
  socket: TestSocket,
  playerId: string,
  joinToken: string,
  sessionId = 'match-scout',
  resumeToken?: string
): Record<string, unknown> {
  const cb = vi.fn();
  socket.handlers.autoJoinRoom({ sessionId, playerId, joinToken, resumeToken }, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  return cb.mock.calls[0][0] as Record<string, unknown>;
}

describe('registerScout host synchronization', () => {
  afterEach(() => {
    for (const code of Array.from(getAllRooms().keys())) {
      deleteRoom(code);
    }
    clearAllParties();
    vi.clearAllMocks();
  });

  it('assigns the new platform host as game host after the original platform host disconnects', () => {
    const ns = setupScoutServer();
    const { party, tokens } = setupParty();

    const hostSocket = makeSocket('game-host-socket');
    ns.connect(hostSocket);
    const hostJoin = autoJoin(hostSocket, 'host', tokens.host);
    const roomCode = hostJoin.roomCode as string;

    party.members.get('host')!.connected = false;
    party.hostPlayerId = 'guest';

    const guestSocket = makeSocket('game-guest-socket');
    ns.connect(guestSocket);
    autoJoin(guestSocket, 'guest', tokens.guest);

    const room = getRoom(roomCode);
    expect(room?.hostId).toBe('guest');
    expect(room?.players.guest?.isHost).toBe(true);
    expect(room?.players.host?.isHost).toBe(false);
  });

  it('assigns a fallback host when the game host socket disconnects', () => {
    const ns = setupScoutServer();
    const { party, tokens } = setupParty();

    const hostSocket = makeSocket('game-host-socket');
    ns.connect(hostSocket);
    const hostJoin = autoJoin(hostSocket, 'host', tokens.host);
    const roomCode = hostJoin.roomCode as string;

    const guestSocket = makeSocket('game-guest-socket');
    ns.connect(guestSocket);
    autoJoin(guestSocket, 'guest', tokens.guest);

    party.members.get('host')!.connected = false;
    hostSocket.handlers.disconnect('transport close');

    const room = getRoom(roomCode);
    expect(room?.players.host?.connected).toBe(false);
    expect(room?.hostId).toBe('guest');
    expect(room?.players.guest?.isHost).toBe(true);
  });

  it('does not reinstate an old disconnected host when that player reconnects', () => {
    const ns = setupScoutServer();
    const { party, tokens } = setupParty();

    const hostSocket = makeSocket('game-host-socket');
    ns.connect(hostSocket);
    const hostJoin = autoJoin(hostSocket, 'host', tokens.host);
    const roomCode = hostJoin.roomCode as string;
    const hostGameResumeToken = hostJoin.resumeToken as string;

    const guestSocket = makeSocket('game-guest-socket');
    ns.connect(guestSocket);
    autoJoin(guestSocket, 'guest', tokens.guest);

    party.members.get('host')!.connected = false;
    party.hostPlayerId = 'guest';
    hostSocket.handlers.disconnect('transport close');

    const reconnectSocket = makeSocket('game-host-reconnect-socket');
    ns.connect(reconnectSocket);
    autoJoin(reconnectSocket, 'host', tokens.host, 'match-scout', hostGameResumeToken);

    const room = getRoom(roomCode);
    expect(room?.players.host?.connected).toBe(true);
    expect(room?.hostId).toBe('guest');
    expect(room?.players.guest?.isHost).toBe(true);
    expect(room?.players.host?.isHost).toBe(false);

    const oldHostStart = vi.fn();
    reconnectSocket.handlers.startGame({ roomCode }, oldHostStart);
    expect(oldHostStart).toHaveBeenCalledWith({ ok: false, error: 'Only host can start' });
  });
});
