import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PartySession } from '../../../apps/platform/server/party/types';
import { clearAllParties, createParty } from '../../../apps/platform/server/party/partyStore';
import { __resetRoomStoreForTests, getRoomByCode } from '../server/src/models/room';
import { currentDrawingPlayerId } from '../server/src/managers/roundManager';
import { registerKritzelagent } from '../server/src/socketHandlers';

interface TestSocket {
  id: string;
  data: Record<string, unknown>;
  handshake: { auth: Record<string, string> };
  join: Mock;
  leave: Mock;
  disconnect: Mock;
  emit: Mock;
  on: (event: string, handler: (...args: unknown[]) => void) => TestSocket;
  handlers: Record<string, (...args: unknown[]) => void>;
}

function makeNamespace() {
  const middleware: Array<(socket: TestSocket, next: (error?: Error) => void) => void> = [];
  let connectionHandler: ((socket: TestSocket) => void) | undefined;
  const emissions: Array<{ target: string; event: string; payload: unknown }> = [];
  const nsp = {
    use(fn: (socket: TestSocket, next: (error?: Error) => void) => void) {
      middleware.push(fn);
      return nsp;
    },
    on(event: string, handler: (socket: TestSocket) => void) {
      if (event === 'connection') connectionHandler = handler;
      return nsp;
    },
    to(target: string) {
      return {
        emit(event: string, payload: unknown) {
          emissions.push({ target, event, payload });
        },
      };
    },
    sockets: new Map<string, TestSocket>(),
  };
  return {
    nsp,
    emissions,
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
    handlers,
  };
  return socket;
}

function setupParty(matchKey = 'match-kritzelagent'): {
  party: PartySession;
  tokens: Record<string, string>;
} {
  const { party, hostResumeToken } = createParty('host', 'Host', 'party-host-socket');
  const tokens: Record<string, string> = { host: hostResumeToken };
  for (let index = 2; index <= 5; index += 1) {
    const playerId = `guest-${index}`;
    const token = `party-token-${index}`;
    party.members.set(playerId, {
      playerId,
      name: `Guest ${index}`,
      connected: true,
      socketId: `party-${playerId}-socket`,
      resumeToken: token,
    });
    tokens[playerId] = token;
  }
  party.status = 'in-match';
  party.activeMatch = {
    gameId: 'kritzelagent',
    matchKey,
    namespace: '/g/kritzelagent',
    startedAt: Date.now(),
  };
  return { party, tokens };
}

function autoJoin(
  socket: TestSocket,
  playerId: string,
  joinToken: string,
  sessionId: string,
  resumeToken?: string
): Record<string, unknown> {
  const callback = vi.fn();
  socket.handlers.autoJoinRoom({ sessionId, playerId, joinToken, resumeToken }, callback);
  expect(callback).toHaveBeenCalledTimes(1);
  return callback.mock.calls[0][0] as Record<string, unknown>;
}

describe('kritzelagent socket security and lifecycle', () => {
  afterEach(() => {
    __resetRoomStoreForTests();
    clearAllParties();
    vi.clearAllMocks();
  });

  it.each(['skipped-slot', 'round-start-absentee'])(
    'completes drawing and voting after authenticated resume: %s',
    (scenario) => {
      const namespace = makeNamespace();
      registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
      const { party, tokens } = setupParty();
      if (scenario === 'round-start-absentee') {
        tokens['guest-6'] = 'party-token-6';
        party.members.set('guest-6', {
          playerId: 'guest-6',
          name: 'Guest 6',
          connected: true,
          socketId: 'party-guest-6',
          resumeToken: tokens['guest-6'],
        });
      }
      const sockets = new Map<string, TestSocket>();
      const resumes = new Map<string, string>();
      let roomCode = '';
      for (const id of Object.keys(tokens)) {
        const socket = makeSocket(`${id}-game`);
        namespace.connect(socket);
        const joined = autoJoin(socket, id, tokens[id]!, 'match-kritzelagent');
        expect(joined.ok).toBe(true);
        roomCode = joined.roomCode as string;
        sockets.set(id, socket);
        resumes.set(id, joined.resumeToken as string);
      }
      const action = (id: string, event: string, extra = {}) => {
        const callback = vi.fn();
        sockets.get(id)!.handlers[event]!({ roomCode, ...extra }, callback);
        expect(callback).toHaveBeenCalledWith({ ok: true });
      };
      if (scenario === 'round-start-absentee') sockets.get('guest-6')!.handlers.disconnect!();
      action('host', 'startGame');
      const room = getRoomByCode(roomCode)!;
      const resumedId = scenario === 'skipped-slot' ? currentDrawingPlayerId(room)! : 'guest-6';
      if (scenario === 'skipped-slot') sockets.get(resumedId)!.handlers.disconnect!();
      const reconnect = makeSocket('resumed-game');
      namespace.connect(reconnect);
      expect(
        autoJoin(
          reconnect,
          resumedId,
          tokens[resumedId]!,
          'match-kritzelagent',
          resumes.get(resumedId)
        )
      ).toMatchObject({ ok: true });
      sockets.set(resumedId, reconnect);
      if (scenario === 'round-start-absentee') {
        expect(
          namespace.emissions.filter(
            (event) => event.target === reconnect.id && event.event === 'privateAssignment'
          )
        ).toEqual([]);
      }
      const invalid = vi.fn();
      const beforeInvalid = room.drawingTurn;
      sockets.get(currentDrawingPlayerId(room)!)!.handlers.submitStroke!(
        {
          roomCode,
          points: Array.from({ length: 81 }, (_, index) => ({ x: index / 80, y: 0.5 })),
        },
        invalid
      );
      expect(invalid).toHaveBeenCalledWith({ ok: false, error: 'Invalid stroke' });
      expect(room.drawingTurn).toBe(beforeInvalid);
      expect(room.strokes).toHaveLength(0);
      for (let turn = 0; turn < 12 && room.phase === 'drawing'; turn += 1)
        action(currentDrawingPlayerId(room)!, 'submitStroke', {
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.9 },
          ],
        });
      expect(room.phase).toBe('voting');
      expect(room.players.find((player) => player.id === resumedId)?.strokesSubmitted).toBe(
        scenario === 'skipped-slot' ? 1 : 0
      );
      const artistId = room.drawingOrder.find((id) => id !== room.agentId)!;
      for (const id of room.drawingOrder)
        action(id, 'submitVote', {
          targetPlayerId: id === room.agentId ? artistId : room.agentId!,
        });
      expect(room.phase).toBe('agentGuess');
      action(room.agentId!, 'submitAgentGuess', { guess: 'incorrect guess' });
      expect(room.phase).toBe('reveal');
      const lastUpdate = namespace.emissions
        .filter((event) => event.target === reconnect.id && event.event === 'roomUpdate')
        .at(-1);
      expect(lastUpdate?.payload).toMatchObject({ phase: 'reveal', activePlayerId: null });
    }
  );

  it('rejects an unauthorized party member before creating a game room', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    setupParty();
    const socket = makeSocket('attacker');
    namespace.connect(socket);

    expect(autoJoin(socket, 'attacker', 'not-a-party-token', 'match-kritzelagent')).toEqual({
      ok: false,
      error: 'Not authorized for this match',
    });
    expect(getRoomByCode('does-not-exist')).toBeUndefined();
  });

  // F20 regression: kritzelagent's own test suite covered the wrong-token
  // case but not the missing-token case, unlike herd-mentality's suite for
  // the identical pattern.
  it('requires a resume token at all when reconnecting an existing identity', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const { tokens } = setupParty();
    const hostSocket = makeSocket('host-game');
    namespace.connect(hostSocket);
    autoJoin(hostSocket, 'host', tokens.host!, 'match-kritzelagent');

    const reconnect = makeSocket('host-reconnect');
    namespace.connect(reconnect);
    expect(autoJoin(reconnect, 'host', tokens.host!, 'match-kritzelagent')).toEqual({
      ok: false,
      error: 'Resume token required',
    });
  });

  it('requires the exact resume token when reconnecting an existing identity', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const { tokens } = setupParty();
    const hostSocket = makeSocket('host-game');
    namespace.connect(hostSocket);
    const created = autoJoin(hostSocket, 'host', tokens.host!, 'match-kritzelagent');
    const roomCode = created.roomCode as string;

    const reconnect = makeSocket('host-reconnect');
    namespace.connect(reconnect);
    expect(autoJoin(reconnect, 'host', tokens.host!, 'match-kritzelagent', 'wrong-token')).toEqual({
      ok: false,
      error: 'Invalid resume token',
    });
    expect(getRoomByCode(roomCode)?.players[0]?.connected).toBe(true);
  });

  it('derives the stroke owner from the authorized socket identity', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const { tokens } = setupParty();
    let roomCode = '';
    const sockets = ['host', 'guest-2', 'guest-3', 'guest-4', 'guest-5'].map((id) => {
      const socket = makeSocket(`${id}-game`);
      namespace.connect(socket);
      const joined = autoJoin(socket, id, tokens[id]!, 'match-kritzelagent');
      if (!roomCode) roomCode = joined.roomCode as string;
      return { id, socket };
    });
    const hostSocket = sockets[0]!.socket;
    const startCallback = vi.fn();
    hostSocket.handlers.startGame({ roomCode: roomCode, playerId: 'guest-2' }, startCallback);
    expect(startCallback).toHaveBeenCalledWith({ ok: true });

    const room = roomCode ? getRoomByCode(roomCode) : undefined;
    const activeId = room?.drawingOrder[0];
    const activeSocket = sockets.find((entry) => entry.id === activeId)?.socket;
    expect(activeSocket).toBeDefined();
    const strokeCallback = vi.fn();
    activeSocket!.handlers.submitStroke(
      {
        roomCode: roomCode,
        playerId: 'host',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.4, y: 0.4 },
        ],
      },
      strokeCallback
    );
    expect(strokeCallback).toHaveBeenCalledWith({ ok: true });
    expect(getRoomByCode(roomCode)?.strokes[0]?.playerId).toBe(activeId);
  });

  // F20 regression: kritzelagent's own test suite covered a happy-path host
  // action but never asserted that a non-host caller is rejected for
  // startGame/nextRound/restartGame, unlike herd-mentality's suite.
  it('rejects startGame, nextRound, and restartGame from a non-host player', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const { tokens } = setupParty();
    let roomCode = '';
    const sockets = ['host', 'guest-2', 'guest-3', 'guest-4', 'guest-5'].map((id) => {
      const socket = makeSocket(`${id}-game`);
      namespace.connect(socket);
      const joined = autoJoin(socket, id, tokens[id]!, 'match-kritzelagent');
      if (!roomCode) roomCode = joined.roomCode as string;
      return socket;
    });
    const guestSocket = sockets[1]!;

    const startCb = vi.fn();
    guestSocket.handlers.startGame({ roomCode }, startCb);
    expect(startCb).toHaveBeenCalledWith({ ok: false, error: 'Only host can start' });

    const nextRoundCb = vi.fn();
    guestSocket.handlers.nextRound({ roomCode }, nextRoundCb);
    expect(nextRoundCb).toHaveBeenCalledWith({ ok: false, error: 'Only host can act' });

    const restartCb = vi.fn();
    guestSocket.handlers.restartGame({ roomCode }, restartCb);
    expect(restartCb).toHaveBeenCalledWith({ ok: false, error: 'Only host can act' });
  });

  it('lets only the host change the rounds in the lobby and validates the payload', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const { tokens } = setupParty();
    let roomCode = '';
    const sockets = ['host', 'guest-2', 'guest-3', 'guest-4', 'guest-5'].map((id) => {
      const socket = makeSocket(`${id}-game`);
      namespace.connect(socket);
      const joined = autoJoin(socket, id, tokens[id]!, 'match-kritzelagent');
      if (!roomCode) roomCode = joined.roomCode as string;
      return socket;
    });
    const [host, guest] = sockets as [TestSocket, TestSocket];

    const ok = vi.fn();
    host.handlers.setTotalRounds({ roomCode, totalRounds: 7 }, ok);
    expect(ok).toHaveBeenCalledWith({ ok: true });

    const denied = vi.fn();
    guest.handlers.setTotalRounds({ roomCode, totalRounds: 3 }, denied);
    expect(denied).toHaveBeenCalledWith({ ok: false, error: 'Only host can change rounds' });

    for (const totalRounds of ['3', null, undefined, {}, [3]]) {
      const cb = vi.fn();
      expect(() => host.handlers.setTotalRounds({ roomCode, totalRounds }, cb)).not.toThrow();
      expect(cb).toHaveBeenCalledWith({ ok: false, error: 'Invalid request' });
    }

    host.handlers.startGame({ roomCode }, vi.fn());
    const late = vi.fn();
    host.handlers.setTotalRounds({ roomCode, totalRounds: 3 }, late);
    expect(late).toHaveBeenCalledWith({
      ok: false,
      error: 'Cannot change rounds in phase drawing',
    });
  });

  // F9 regression: submitStroke — the one high-frequency, attacker-shaped
  // payload in this game (real-time drawing input) — previously had no
  // rate limiting at all, unlike connection attempts and party
  // creation/joining.
  it('rate-limits rapid submitStroke calls from the same socket', () => {
    const namespace = makeNamespace();
    registerKritzelagent({ of: vi.fn(() => namespace.nsp) } as never, '/g/kritzelagent');
    const socket = makeSocket('flooder');
    namespace.connect(socket);

    const responses: Array<{ ok: boolean; error?: string }> = [];
    for (let i = 0; i < 11; i += 1) {
      const cb = vi.fn();
      socket.handlers.submitStroke({ roomCode: 'nonexistent', playerId: 'x', points: [] }, cb);
      responses.push(cb.mock.calls[0][0]);
    }

    // First 10 (STROKE_RATE_LIMIT_MAX) hit ordinary "room not found";
    // the 11th within the same 1s window is rejected by the rate limiter.
    expect(responses.slice(0, 10).every((r) => r.error === 'Room not found')).toBe(true);
    expect(responses[10]).toEqual({ ok: false, error: 'Too many strokes — slow down' });
  });
});
