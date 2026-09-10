import { beforeEach, afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PartySession } from '../../../apps/platform/server/party/types';
import { clearAllParties, createParty } from '../../../apps/platform/server/party/partyStore';
import { buildRoomView } from '../server/src/managers/broadcastManager';
import { __listRoomsForTests, getRoomByCode } from '../server/src/models/room';
import { getSocketIndex } from '../server/src/models/player';
import { __resetHerdMentalityForTests, registerHerdMentality } from '../server/src/socketHandlers';

interface TestSocket {
  id: string;
  data: Record<string, string | undefined>;
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
  const roomEmitter = { emit: vi.fn() };
  const nsp = {
    use(fn: (socket: TestSocket, next: (err?: Error) => void) => void) {
      middleware.push(fn);
      return nsp;
    },
    on(event: string, handler: (socket: TestSocket) => void) {
      if (event === 'connection') connectionHandler = handler;
      return nsp;
    },
    to: vi.fn(() => roomEmitter),
    sockets: new Map<string, TestSocket>(),
  };
  return {
    nsp,
    roomEmitter,
    connect(socket: TestSocket) {
      nsp.sockets.set(socket.id, socket);
      for (const fn of middleware) fn(socket, () => {});
      connectionHandler?.(socket);
    },
  };
}

function makeSocket(id: string): TestSocket {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const socket: TestSocket = {
    id,
    data: {},
    handshake: { auth: {} },
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on(event, handler) {
      handlers[event] = handler;
      return socket;
    },
    off: vi.fn(),
    handlers,
  };
  return socket;
}

function setupParty(matchKey = 'herd-match'): {
  party: PartySession;
  tokens: Record<string, string>;
} {
  const { party, hostResumeToken } = createParty('host', 'Host', 'party-host');
  for (const [playerId, name] of [
    ['ben', 'Ben'],
    ['clara', 'Clara'],
    ['david', 'David'],
  ]) {
    party.members.set(playerId, {
      playerId,
      name,
      connected: true,
      socketId: `party-${playerId}`,
      resumeToken: `party-token-${playerId}`,
    });
  }
  party.status = 'in-match';
  party.activeMatch = {
    gameId: 'herd-mentality',
    matchKey,
    namespace: '/g/herd-mentality',
    startedAt: Date.now(),
  };
  return {
    party,
    tokens: {
      host: hostResumeToken,
      ben: 'party-token-ben',
      clara: 'party-token-clara',
      david: 'party-token-david',
    },
  };
}

function setupServer() {
  const namespace = makeNamespace();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
  };
  registerHerdMentality(
    { of: vi.fn(() => namespace.nsp) } as never,
    '/g/herd-mentality',
    logger as never
  );
  return namespace;
}

function autoJoin(socket: TestSocket, playerId: string, joinToken: string, resumeToken?: string) {
  const cb = vi.fn();
  socket.handlers.autoJoinRoom({ sessionId: 'herd-match', playerId, joinToken, resumeToken }, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  return cb.mock.calls[0]![0] as Record<string, unknown>;
}

function latestRoomView(namespace: ReturnType<typeof makeNamespace>) {
  const calls = namespace.roomEmitter.emit.mock.calls.filter(([event]) => event === 'roomUpdate');
  return calls.at(-1)?.[1] as ReturnType<typeof buildRoomView>;
}

describe('Herd Mentality socket handlers', () => {
  beforeEach(() => {
    __resetHerdMentalityForTests();
    clearAllParties();
  });
  afterEach(() => {
    __resetHerdMentalityForTests();
    clearAllParties();
  });

  it('binds the platform host id and keeps host authority after a guest joins', () => {
    const namespace = setupServer();
    const { tokens } = setupParty();
    const host = makeSocket('host-socket');
    const guest = makeSocket('ben-socket');
    namespace.connect(host);
    namespace.connect(guest);
    const first = autoJoin(host, 'host', tokens.host);
    autoJoin(guest, 'ben', tokens.ben);

    const room = getRoomByCode(first.roomCode as string)!;
    const view = buildRoomView(room);
    expect(room.hostPlayerId).toBe('host');
    expect(view.players.find((player) => player.id === 'host')?.isHost).toBe(true);
    expect(view.players.find((player) => player.id === 'ben')?.isHost).toBe(false);
  });

  it('requires the resume token and rebinds the player to one socket', () => {
    const namespace = setupServer();
    const { party, tokens } = setupParty();
    const original = makeSocket('host-original');
    namespace.connect(original);
    const first = autoJoin(original, 'host', tokens.host);
    party.members.get('host')!.connected = false;
    const reconnect = makeSocket('host-reconnect');
    namespace.connect(reconnect);

    expect(autoJoin(reconnect, 'host', tokens.host)).toEqual({
      ok: false,
      error: 'Resume token required',
    });
    const result = autoJoin(reconnect, 'host', tokens.host, first.resumeToken as string);
    expect(result.ok).toBe(true);
    expect(original.disconnect).toHaveBeenCalledWith(true);
    expect(getSocketIndex(original.id)).toBeUndefined();
    expect(getSocketIndex(reconnect.id)?.playerId).toBe('host');
    expect(buildRoomView(getRoomByCode(first.roomCode as string)!)).toMatchObject({
      players: [{ id: 'host', isHost: true }],
    });
  });

  it('rejects malformed, invalid, duplicate, and non-host actions without leaking answers', () => {
    const namespace = setupServer();
    const { tokens } = setupParty();
    const sockets = ['host', 'ben', 'clara', 'david'].map((id) => makeSocket(`${id}-socket`));
    sockets.forEach((socket) => namespace.connect(socket));
    const joined = sockets.map((socket, index) =>
      autoJoin(
        socket,
        ['host', 'ben', 'clara', 'david'][index]!,
        tokens[['host', 'ben', 'clara', 'david'][index]!]!
      )
    );
    const roomCode = joined[0]!.roomCode as string;
    const host = sockets[0]!;
    const guest = sockets[1]!;
    const action = (socket: TestSocket, event: string, payload: unknown) => {
      const cb = vi.fn();
      socket.handlers[event]!(payload, cb);
      return cb.mock.calls[0]![0];
    };

    expect(action(host, 'startGame', null)).toEqual({ ok: false, error: 'Invalid request' });
    expect(action(host, 'startGame', { roomCode })).toEqual({ ok: true });
    expect(action(host, 'submitAnswer', { roomCode, answer: 'Pizza' })).toEqual({ ok: true });
    expect(action(host, 'submitAnswer', { roomCode, answer: 'pizza' })).toEqual({
      ok: false,
      error: 'Answer already submitted',
    });
    expect(action(guest, 'revealAnswers', { roomCode })).toEqual({
      ok: false,
      error: 'Only host can reveal',
    });
    expect(latestRoomView(namespace).answers).toEqual([]);
    expect(latestRoomView(namespace).result).toBeNull();
  });

  it('moves to allSubmitted when an unsubmitted player disconnects', () => {
    const namespace = setupServer();
    const { tokens } = setupParty();
    const sockets = ['host', 'ben', 'clara', 'david'].map((id) => makeSocket(`${id}-socket`));
    sockets.forEach((socket) => namespace.connect(socket));
    const joined = sockets.map((socket, index) =>
      autoJoin(
        socket,
        ['host', 'ben', 'clara', 'david'][index]!,
        tokens[['host', 'ben', 'clara', 'david'][index]!]!
      )
    );
    const roomCode = joined[0]!.roomCode as string;
    const startCb = vi.fn();
    sockets[0]!.handlers.startGame!({ roomCode }, startCb);
    expect(startCb).toHaveBeenCalledWith({ ok: true });
    const submit = (socket: TestSocket, answer: string) => {
      const cb = vi.fn();
      socket.handlers.submitAnswer({ roomCode, answer }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: true });
    };
    const room = getRoomByCode(roomCode)!;
    const host = sockets[0]!;
    const ben = sockets[1]!;
    const clara = sockets[2]!;
    submit(host, 'Pizza');
    submit(ben, 'Pizza');
    submit(clara, 'Salat');
    sockets[3]!.handlers.disconnect!();
    expect(room.phase).toBe('allSubmitted');
  });
});
