import type { Server } from 'socket.io';
import { registerPartyHandlers } from '../server/party/partyHandlers';
import {
  getParty,
  getPartyByInviteCode,
  deleteParty,
  clearPartyCleanup,
} from '../server/party/partyStore';

vi.mock('nanoid', () => {
  let counter = 0;
  return {
    nanoid: (size?: number) => `id-${size ?? 0}-${++counter}`,
  };
});

vi.mock('../server/registry/index', () => ({
  getGame: (gameId: string) => {
    if (gameId === 'test-game') {
      return {
        definition: { id: 'test-game', name: 'Test', minPlayers: 2, maxPlayers: 10 },
        registerServer: vi.fn(),
        cleanupMatch: vi.fn(),
      };
    }
    return undefined;
  },
}));

type Handler = (...args: any[]) => void;

function createNamespace() {
  let connectionHandler: ((socket: any) => void) | undefined;
  return {
    on: vi.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') connectionHandler = handler;
    }),
    to: vi.fn(() => ({ emit: vi.fn() })),
    getConnectionHandler: () => connectionHandler,
  };
}

function createSocket(id: string) {
  const handlers: Record<string, Handler> = {};
  return {
    id,
    on: vi.fn((event: string, handler: Handler) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    handlers,
  };
}

function setup() {
  const namespace = createNamespace();
  const io = { of: vi.fn(() => namespace) } as unknown as Server;
  registerPartyHandlers(io);
  const connectionHandler = namespace.getConnectionHandler()!;
  return { io, namespace, connectionHandler };
}

function connectSocket(ctx: ReturnType<typeof setup>, socketId: string) {
  const socket = createSocket(socketId);
  ctx.connectionHandler(socket);
  return socket;
}

describe('partyHandlers', () => {
  const partyIds: string[] = [];

  afterEach(() => {
    vi.useRealTimers();
    for (const id of partyIds) {
      clearPartyCleanup(id);
      deleteParty(id);
    }
    partyIds.length = 0;
  });

  function createPartyViaSocket(ctx: ReturnType<typeof setup>, socketId: string, name = 'Host') {
    const socket = connectSocket(ctx, socketId);
    const cb = vi.fn();
    socket.handlers.createParty({ playerName: name }, cb);
    const res = cb.mock.calls[0][0];
    if (res.ok) partyIds.push(res.partyView.partyId);
    return { socket, res };
  }

  // ────────────────────────────────────────────────────────────────
  // createParty / joinParty basics
  // ────────────────────────────────────────────────────────────────

  it('creates a party and returns valid state', () => {
    const ctx = setup();
    const { res } = createPartyViaSocket(ctx, 'sock-1');
    expect(res.ok).toBe(true);
    expect(res.partyView.status).toBe('lobby');
    expect(res.partyView.members).toHaveLength(1);
    expect(res.playerId).toBeTruthy();
    expect(res.resumeToken).toBeTruthy();
  });

  it('rejects party creation with empty name', () => {
    const ctx = setup();
    const socket = connectSocket(ctx, 'sock-1');
    const cb = vi.fn();
    socket.handlers.createParty({ playerName: '  ' }, cb);
    expect(cb.mock.calls[0][0].ok).toBe(false);
  });

  it('allows a second player to join via invite code', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    const joiner = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      cb
    );

    const joinRes = cb.mock.calls[0][0];
    expect(joinRes.ok).toBe(true);
    expect(joinRes.partyView.members).toHaveLength(2);
  });

  it('join cancels a previously scheduled party cleanup timer', () => {
    vi.useFakeTimers();
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-1');
    const partyId = hostRes.partyView.partyId;

    hostSocket.handlers.disconnect();

    const joiner = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      cb
    );

    expect(cb.mock.calls[0][0].ok).toBe(true);

    vi.advanceTimersByTime(29 * 60 * 1000);
    joiner.handlers.leaveParty({ playerId: cb.mock.calls[0][0].playerId });

    // Crossing the original timeout must not delete the party if join cleared the old timer.
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(getParty(partyId)).toBeDefined();

    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(getParty(partyId)).toBeUndefined();
    partyIds.pop();
  });

  it('rejects join when party is in-match', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1');
    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    party.status = 'in-match';

    const joiner = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    joiner.handlers.joinParty({ inviteCode: hostRes.partyView.inviteCode, playerName: 'Late' }, cb);
    expect(cb.mock.calls[0][0]).toEqual({ ok: false, error: 'Party is already in a match' });
  });

  it('rejects duplicate name on join', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1', 'Alice');

    const joiner = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'alice' },
      cb
    );
    expect(cb.mock.calls[0][0].ok).toBe(false);
    expect(cb.mock.calls[0][0].error).toContain('Name already taken');
  });

  // ────────────────────────────────────────────────────────────────
  // resumeParty
  // ────────────────────────────────────────────────────────────────

  it('resumes a session with valid resume token', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    const newSocket = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    newSocket.handlers.resumeParty(
      {
        inviteCode: hostRes.partyView.inviteCode,
        playerId: hostRes.playerId,
        resumeToken: hostRes.resumeToken,
      },
      cb
    );
    expect(cb.mock.calls[0][0].ok).toBe(true);
  });

  it('rejects resume with wrong token', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    const newSocket = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    newSocket.handlers.resumeParty(
      {
        inviteCode: hostRes.partyView.inviteCode,
        playerId: hostRes.playerId,
        resumeToken: 'wrong-token',
      },
      cb
    );
    expect(cb.mock.calls[0][0]).toEqual({ ok: false, error: 'Invalid resume token' });
  });

  it('resume cancels pending party cleanup', () => {
    vi.useFakeTimers();
    const ctx = setup();
    const { socket, res: hostRes } = createPartyViaSocket(ctx, 'sock-1');
    const partyId = hostRes.partyView.partyId;

    // Simulate disconnect (triggers cleanup scheduling)
    socket.handlers.disconnect();

    // Resume on new socket
    const newSocket = connectSocket(ctx, 'sock-2');
    const cb = vi.fn();
    newSocket.handlers.resumeParty(
      {
        inviteCode: hostRes.partyView.inviteCode,
        playerId: hostRes.playerId,
        resumeToken: hostRes.resumeToken,
      },
      cb
    );
    expect(cb.mock.calls[0][0].ok).toBe(true);

    // Advance past cleanup timeout — party should survive
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(getParty(partyId)).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────
  // leaveParty + host transfer
  // ────────────────────────────────────────────────────────────────

  it('transfers host when host leaves', () => {
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    // Second player joins
    const joiner = connectSocket(ctx, 'sock-2');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      joinCb
    );
    const joinRes = joinCb.mock.calls[0][0];

    // Host leaves
    hostSocket.handlers.leaveParty({ playerId: hostRes.playerId });

    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    expect(party.hostPlayerId).toBe(joinRes.playerId);
    expect(party.members.size).toBe(1);
  });

  it('deletes party when last member leaves', () => {
    const ctx = setup();
    const { socket, res } = createPartyViaSocket(ctx, 'sock-1');

    socket.handlers.leaveParty({ playerId: res.playerId });
    // Remove from tracking — already gone
    partyIds.pop();

    expect(getPartyByInviteCode(res.partyView.inviteCode)).toBeUndefined();
  });

  it('schedules cleanup when leaveParty leaves only disconnected members behind', () => {
    vi.useFakeTimers();
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-host');

    hostSocket.handlers.disconnect();

    const joiner = connectSocket(ctx, 'sock-join');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      joinCb
    );
    const joinerId = joinCb.mock.calls[0][0].playerId;

    joiner.handlers.leaveParty({ playerId: joinerId });

    const partyId = hostRes.partyView.partyId;
    expect(getParty(partyId)).toBeDefined();

    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(getParty(partyId)).toBeUndefined();
    partyIds.pop();
  });

  // ────────────────────────────────────────────────────────────────
  // disconnect: host transfer + GC scheduling
  // ────────────────────────────────────────────────────────────────

  it('transfers host to next connected member on disconnect', () => {
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    const joiner = connectSocket(ctx, 'sock-2');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      joinCb
    );
    const joinRes = joinCb.mock.calls[0][0];

    // Host disconnects
    hostSocket.handlers.disconnect();

    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    expect(party.hostPlayerId).toBe(joinRes.playerId);
    // Original host still in members but disconnected
    expect(party.members.get(hostRes.playerId)?.connected).toBe(false);
  });

  it('schedules party cleanup when all members disconnect', () => {
    vi.useFakeTimers();
    const ctx = setup();
    const { socket, res } = createPartyViaSocket(ctx, 'sock-1');
    const partyId = res.partyView.partyId;

    socket.handlers.disconnect();

    // Not deleted immediately
    expect(getParty(partyId)).toBeDefined();

    // Deleted after timeout
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(getParty(partyId)).toBeUndefined();
    partyIds.pop();
  });

  // ────────────────────────────────────────────────────────────────
  // selectGame + launchGame
  // ────────────────────────────────────────────────────────────────

  it('only the host can select a game', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-1');

    const joiner = connectSocket(ctx, 'sock-2');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'Joiner' },
      joinCb
    );

    const selectCb = vi.fn();
    joiner.handlers.selectGame(
      { playerId: joinCb.mock.calls[0][0].playerId, gameId: 'test-game' },
      selectCb
    );
    expect(selectCb.mock.calls[0][0]).toEqual({
      ok: false,
      error: 'Only the host can select a game',
    });
  });

  it('host can select a game and launch it', () => {
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-host');

    // Need 2 players to meet minPlayers
    const joiner = connectSocket(ctx, 'sock-join');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'P2' },
      joinCb
    );

    // Select
    const selectCb = vi.fn();
    hostSocket.handlers.selectGame({ playerId: hostRes.playerId, gameId: 'test-game' }, selectCb);
    expect(selectCb.mock.calls[0][0]).toEqual({ ok: true });

    // Launch
    const launchCb = vi.fn();
    hostSocket.handlers.launchGame({ playerId: hostRes.playerId }, launchCb);
    expect(launchCb.mock.calls[0][0]).toEqual({ ok: true });

    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    expect(party.status).toBe('in-match');
    expect(party.activeMatch).toBeTruthy();
    expect(party.activeMatch?.gameId).toBe('test-game');
  });

  it('rejects launch with insufficient players', () => {
    const ctx = setup();
    const { socket, res } = createPartyViaSocket(ctx, 'sock-1');

    const selectCb = vi.fn();
    socket.handlers.selectGame({ playerId: res.playerId, gameId: 'test-game' }, selectCb);

    // Only 1 player, minPlayers is 2
    const launchCb = vi.fn();
    socket.handlers.launchGame({ playerId: res.playerId }, launchCb);
    expect(launchCb.mock.calls[0][0].ok).toBe(false);
    expect(launchCb.mock.calls[0][0].error).toContain('at least');
  });

  it('rejects unknown game on selectGame', () => {
    const ctx = setup();
    const { socket, res } = createPartyViaSocket(ctx, 'sock-1');

    const cb = vi.fn();
    socket.handlers.selectGame({ playerId: res.playerId, gameId: 'nonexistent' }, cb);
    expect(cb.mock.calls[0][0]).toEqual({ ok: false, error: 'Unknown game' });
  });

  // ────────────────────────────────────────────────────────────────
  // ackReturnedToLobby — socket validation
  // ────────────────────────────────────────────────────────────────

  it('rejects ackReturnedToLobby from a socket that does not own the playerId', () => {
    const ctx = setup();
    const { socket: hostSocket, res: hostRes } = createPartyViaSocket(ctx, 'sock-host');

    const joiner = connectSocket(ctx, 'sock-join');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'P2' },
      joinCb
    );
    const joinerId = joinCb.mock.calls[0][0].playerId;

    // Put party in returning state
    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    party.status = 'returning';
    party.returnAcks = new Set();

    // Host tries to ACK the joiner's playerId — should be silently rejected
    hostSocket.handlers.ackReturnedToLobby({ playerId: joinerId });

    expect(party.returnAcks.has(joinerId)).toBe(false);
  });

  it('accepts ackReturnedToLobby from the correct socket', () => {
    const ctx = setup();
    const { res: hostRes } = createPartyViaSocket(ctx, 'sock-host');

    const joiner = connectSocket(ctx, 'sock-join');
    const joinCb = vi.fn();
    joiner.handlers.joinParty(
      { inviteCode: hostRes.partyView.inviteCode, playerName: 'P2' },
      joinCb
    );
    const joinerId = joinCb.mock.calls[0][0].playerId;

    const party = getPartyByInviteCode(hostRes.partyView.inviteCode)!;
    party.status = 'returning';
    party.returnAcks = new Set();

    // Joiner ACKs for themselves — should work
    joiner.handlers.ackReturnedToLobby({ playerId: joinerId });
    expect(party.returnAcks.has(joinerId)).toBe(true);
  });
});
