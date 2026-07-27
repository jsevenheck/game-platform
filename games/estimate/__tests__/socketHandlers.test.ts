import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PartySession } from '../../../apps/platform/server/party/types';
import { clearAllParties, createParty } from '../../../apps/platform/server/party/partyStore';
import { registerEstimate, __resetEstimateForTests } from '../server/src/socketHandlers';
import { __listRoomsForTests } from '../server/src/models/room';

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

function setupServer() {
  const ns = makeNamespace();
  const io = makeIo(ns.nsp);
  const gameLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
  };
  registerEstimate(io as never, '/g/estimate', gameLogger as never);
  return ns;
}

function setupParty(matchKey = 'match-estimate'): {
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
    gameId: 'estimate',
    matchKey,
    namespace: '/g/estimate',
    startedAt: Date.now(),
  };
  return { party, tokens: { host: hostResumeToken, guest: 'party-token-guest' } };
}

function autoJoin(
  socket: TestSocket,
  playerId: string,
  joinToken: string,
  sessionId = 'match-estimate',
  resumeToken?: string
): Record<string, unknown> {
  const cb = vi.fn();
  socket.handlers.autoJoinRoom({ sessionId, playerId, joinToken, resumeToken }, cb);
  expect(cb).toHaveBeenCalledTimes(1);
  return cb.mock.calls[0]![0] as Record<string, unknown>;
}

function firstRoom() {
  const rooms = __listRoomsForTests();
  return rooms[0];
}

describe('registerEstimate', () => {
  beforeEach(() => {
    __resetEstimateForTests();
    clearAllParties();
    vi.clearAllMocks();
  });

  afterEach(() => {
    __resetEstimateForTests();
    clearAllParties();
  });

  describe('autoJoinRoom', () => {
    it('rejects when joinToken is missing', () => {
      const ns = setupServer();
      setupParty();

      const socket = makeSocket('game-host-socket');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.autoJoinRoom({ sessionId: 'match-estimate', playerId: 'host' }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Not authorized for this match' });
    });

    it('rejects when joinToken does not match the party member resumeToken', () => {
      const ns = setupServer();
      setupParty();

      const socket = makeSocket('game-host-socket');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.autoJoinRoom(
        { sessionId: 'match-estimate', playerId: 'host', joinToken: 'wrong-token' },
        cb
      );
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Not authorized for this match' });
    });

    it('rejects when playerId is not a party member', () => {
      const ns = setupServer();
      setupParty();

      const socket = makeSocket('game-stranger-socket');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.autoJoinRoom(
        { sessionId: 'match-estimate', playerId: 'stranger', joinToken: 'whatever' },
        cb
      );
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Not authorized for this match' });
    });

    it('creates a room on first join and returns resumeToken', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      const res = autoJoin(hostSocket, 'host', tokens.host);

      expect(res.ok).toBe(true);
      expect(typeof res.roomCode).toBe('string');
      expect(typeof res.resumeToken).toBe('string');
      expect(res.resumeToken!.length).toBeGreaterThan(0);
      const room = firstRoom();
      expect(room).toBeDefined();
      expect(room!.roomCode).toBe(res.roomCode);
      expect(room!.hostPlayerId).toBeDefined();
    });

    it('requires resumeToken for a returning player who already has one', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      const first = autoJoin(hostSocket, 'host', tokens.host);
      const hostResume = first.resumeToken as string;

      const reconnect = makeSocket('game-host-reconnect-socket');
      ns.connect(reconnect);
      const cb = vi.fn();
      reconnect.handlers.autoJoinRoom(
        { sessionId: 'match-estimate', playerId: 'host', joinToken: tokens.host },
        cb
      );
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Resume token required' });

      // With correct resumeToken it succeeds.
      const cb2 = vi.fn();
      reconnect.handlers.autoJoinRoom(
        {
          sessionId: 'match-estimate',
          playerId: 'host',
          joinToken: tokens.host,
          resumeToken: hostResume,
        },
        cb2
      );
      const res = cb2.mock.calls[0]![0] as Record<string, unknown>;
      expect(res.ok).toBe(true);
    });

    it('rejects rejoin with a wrong resumeToken', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);

      const reconnect = makeSocket('game-host-reconnect-socket');
      ns.connect(reconnect);
      const cb = vi.fn();
      reconnect.handlers.autoJoinRoom(
        {
          sessionId: 'match-estimate',
          playerId: 'host',
          joinToken: tokens.host,
          resumeToken: 'not-the-real-token',
        },
        cb
      );
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid resume token' });
    });

    it('lets a new player join an existing lobby', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);

      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      const res = autoJoin(guestSocket, 'guest', tokens.guest);
      expect(res.ok).toBe(true);

      const room = firstRoom()!;
      expect(room.players.length).toBe(2);
    });

    it('rejects a new joiner once the game has started', () => {
      const ns = setupServer();
      const { party, tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);

      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);

      // Host starts the game.
      const startCb = vi.fn();
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, startCb);
      expect(startCb).toHaveBeenCalledWith({ ok: true });

      // Add a third member to the existing party (do NOT call setupParty again,
      // that would overwrite the active party with a fresh one).
      party.members.set('latecomer', {
        playerId: 'latecomer',
        name: 'Late',
        connected: true,
        socketId: 'party-late-socket',
        resumeToken: 'party-token-late',
      });
      const lateSocket = makeSocket('game-late-socket');
      ns.connect(lateSocket);
      const cb = vi.fn();
      lateSocket.handlers.autoJoinRoom(
        {
          sessionId: 'match-estimate',
          playerId: 'latecomer',
          joinToken: 'party-token-late',
        },
        cb
      );
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Game already started' });
    });
  });

  describe('startGame', () => {
    it('only the host may start the game', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);

      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);

      const cb = vi.fn();
      guestSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can start' });
    });

    it('rejects when the room is not in lobby', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);

      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);

      // First start succeeds.
      const startCb = vi.fn();
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, startCb);
      expect(startCb).toHaveBeenCalledWith({ ok: true });

      // Second start fails because the game is already in guessing.
      const startCb2 = vi.fn();
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, startCb2);
      expect(startCb2).toHaveBeenCalledWith({ ok: false, error: 'Game already started' });
    });
  });

  describe('submitGuess', () => {
    it('rejects NaN, Infinity, and out-of-range guesses', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);

      // Start the game.
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());

      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '10', null, 1e12]) {
        const cb = vi.fn();
        hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: bad }, cb);
        expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid guess' });
      }
    });

    it('rejects when the socket is not bound to a room player', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());

      // A third (unbound) socket tries to guess.
      const stranger = makeSocket('game-stranger-socket');
      ns.connect(stranger);
      const cb = vi.fn();
      stranger.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 42 }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Not in room' });
    });

    it('records a valid guess', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());

      const cb = vi.fn();
      hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 100 }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: true });
      const room = firstRoom()!;
      expect(room.players[0]?.socketId).toBe('game-host-socket');
    });
  });

  describe('revealSolution / nextRound / restartGame', () => {
    it('only the host may reveal the solution', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());

      // Both players submit so the room transitions to allSubmitted.
      hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 5 }, vi.fn());
      guestSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 7 }, vi.fn());

      const cb = vi.fn();
      guestSocket.handlers.revealSolution({ roomCode: firstRoom()!.roomCode }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can reveal' });

      const hostCb = vi.fn();
      hostSocket.handlers.revealSolution({ roomCode: firstRoom()!.roomCode }, hostCb);
      expect(hostCb).toHaveBeenCalledWith({ ok: true });
    });

    it('only the host may advance to the next round', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());
      hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
      guestSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
      hostSocket.handlers.revealSolution({ roomCode: firstRoom()!.roomCode }, vi.fn());

      const cb = vi.fn();
      guestSocket.handlers.nextRound({ roomCode: firstRoom()!.roomCode }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can advance' });
    });

    it('only the host may restart the game', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);
      hostSocket.handlers.startGame({ roomCode: firstRoom()!.roomCode }, vi.fn());

      // DEFAULT_TOTAL_ROUNDS is 5, so play 4 rounds then the 5th transitions
      // to 'gameEnd' on nextRound.
      for (let i = 0; i < 4; i += 1) {
        hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
        guestSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
        hostSocket.handlers.revealSolution({ roomCode: firstRoom()!.roomCode }, vi.fn());
        hostSocket.handlers.nextRound({ roomCode: firstRoom()!.roomCode }, vi.fn());
      }
      // Round 5
      hostSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
      guestSocket.handlers.submitGuess({ roomCode: firstRoom()!.roomCode, guess: 1 }, vi.fn());
      hostSocket.handlers.revealSolution({ roomCode: firstRoom()!.roomCode }, vi.fn());
      hostSocket.handlers.nextRound({ roomCode: firstRoom()!.roomCode }, vi.fn());
      expect(firstRoom()!.phase).toBe('gameEnd');

      const cb = vi.fn();
      guestSocket.handlers.restartGame({ roomCode: firstRoom()!.roomCode }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Only host can restart' });

      const hostCb = vi.fn();
      hostSocket.handlers.restartGame({ roomCode: firstRoom()!.roomCode }, hostCb);
      expect(hostCb).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('connection lifecycle', () => {
    it('transitions to allSubmitted when an unsubmitted player disconnects', () => {
      const ns = setupServer();
      const { tokens } = setupParty();

      const hostSocket = makeSocket('game-host-socket');
      ns.connect(hostSocket);
      autoJoin(hostSocket, 'host', tokens.host);
      const guestSocket = makeSocket('game-guest-socket');
      ns.connect(guestSocket);
      autoJoin(guestSocket, 'guest', tokens.guest);

      const room = firstRoom()!;
      hostSocket.handlers.startGame({ roomCode: room.roomCode }, vi.fn());
      hostSocket.handlers.submitGuess({ roomCode: room.roomCode, guess: 42 }, vi.fn());
      expect(room.phase).toBe('guessing');

      guestSocket.handlers.disconnect();

      expect(room.phase).toBe('allSubmitted');
    });
  });

  describe('input validation', () => {
    it('rejects non-object payloads on autoJoinRoom', () => {
      const ns = setupServer();
      const socket = makeSocket('s1');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.autoJoinRoom('not-an-object', cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid request' });
    });

    it('rejects missing sessionId on autoJoinRoom', () => {
      const ns = setupServer();
      const socket = makeSocket('s1');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.autoJoinRoom({ playerId: 'p' }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid request' });
    });

    it('returns Room not found for unknown roomCode', () => {
      const ns = setupServer();
      const socket = makeSocket('s1');
      ns.connect(socket);
      const cb = vi.fn();
      socket.handlers.startGame({ roomCode: 'NOPE' }, cb);
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Room not found' });
    });
  });
});
