import { effectScope } from 'vue';
import { usePartyRequests } from '../src/composables/usePartyRequests';
import { PARTY_ACK_TIMEOUT_MS, type PartySocket } from '../src/composables/usePartySocket';

function setup(connected = true) {
  const listeners = new Set<() => void>();
  let callback: (error: Error | null, response?: unknown) => void = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const socket = {
    connected,
    connect: vi.fn(),
    once: vi.fn((_event: string, cb: () => void) => listeners.add(cb)),
    off: vi.fn((_event: string, cb: () => void) => listeners.delete(cb)),
    timeout: vi.fn(function () {
      return socket;
    }),
    emit: vi.fn((_event: string, _data: unknown, cb: typeof callback) => {
      callback = cb;
      timer = setTimeout(() => cb(new Error('timeout')), PARTY_ACK_TIMEOUT_MS);
    }),
  };
  const scope = effectScope();
  const api = scope.run(() => usePartyRequests(socket as unknown as PartySocket))!;
  return {
    ...api,
    scope,
    socket,
    listeners,
    respond: (response: unknown) => {
      clearTimeout(timer);
      callback(null, response);
    },
    connect: () => {
      socket.connected = true;
      for (const cb of [...listeners]) cb();
    },
  };
}

describe('bounded party acknowledgements', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(['selectGame', 'launchGame', 'replayGame', 'returnToLobby', 'setPartyPublic'] as const)(
    'times out %s without automatically retrying the mutation',
    async (event) => {
      const ctx = setup();
      const response = ctx.request(event, { playerId: 'player', gameId: 'scout', isPublic: true });
      await vi.advanceTimersByTimeAsync(PARTY_ACK_TIMEOUT_MS);
      expect(await response).toEqual({ ok: false, error: 'Request timed out' });
      expect(ctx.socket.emit).toHaveBeenCalledTimes(1);
      ctx.scope.stop();
    }
  );

  it('settles an unsuccessful resume rather than hanging', async () => {
    const ctx = setup();
    const promise = ctx.request('resumeParty', {
      inviteCode: 'ABC123',
      playerId: 'player',
      resumeToken: 'token',
    });
    await Promise.resolve();
    ctx.respond({ ok: false, error: 'Party not found' });
    expect(await promise).toEqual({ ok: false, error: 'Party not found' });
    ctx.scope.stop();
  });

  it('settles pending work on scope disposal and ignores late acknowledgements', async () => {
    const ctx = setup();
    const promise = ctx.request('launchGame', { playerId: 'player' });
    await Promise.resolve();
    ctx.scope.stop();
    expect(await promise).toBeUndefined();
    ctx.respond({ ok: true });
    expect(ctx.isActive()).toBe(false);
  });

  it('bounds the initial connection wait and removes its listener', async () => {
    const ctx = setup(false);
    const promise = ctx.request('resumeParty', {
      inviteCode: 'ABC123',
      playerId: 'player',
      resumeToken: 'token',
    });
    await vi.advanceTimersByTimeAsync(PARTY_ACK_TIMEOUT_MS);
    expect(await promise).toEqual({ ok: false, error: 'Request timed out' });
    expect(ctx.listeners.size).toBe(0);
    expect(ctx.socket.emit).not.toHaveBeenCalled();
    ctx.scope.stop();
  });

  it('does not emit or leave a connect listener after unmount during connection setup', async () => {
    const ctx = setup(false);
    const promise = ctx.request('launchGame', { playerId: 'player' });
    ctx.scope.stop();
    expect(await promise).toBeUndefined();
    ctx.connect();
    expect(ctx.listeners.size).toBe(0);
    expect(ctx.socket.emit).not.toHaveBeenCalled();
  });
});
