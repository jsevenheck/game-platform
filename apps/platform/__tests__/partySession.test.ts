import { createPinia, setActivePinia } from 'pinia';
import { isTerminalResumeError, usePartyStore } from '../src/stores/party';

const session = {
  inviteCode: 'ABC123',
  playerId: 'player',
  playerName: 'Host',
  resumeToken: 'token',
};

describe('isTerminalResumeError', () => {
  it('treats a vanished party or member as terminal', () => {
    expect(isTerminalResumeError('Party not found')).toBe(true);
    expect(isTerminalResumeError('Player not in party')).toBe(true);
    expect(isTerminalResumeError('Invalid resume token')).toBe(true);
  });

  it('keeps the session for transient failures', () => {
    expect(isTerminalResumeError('Too many requests')).toBe(false);
    expect(isTerminalResumeError('Internal error')).toBe(false);
  });
});

describe('party session persistence', () => {
  const values = new Map<string, string>();
  let storage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    setActivePinia(createPinia());
    values.clear();
    storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    };
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('persists and validates a session in a fresh store', () => {
    const store = usePartyStore();
    store.setSession(session);
    store.saveSession(session.inviteCode);
    setActivePinia(createPinia());
    expect(usePartyStore().loadSession()).toEqual(session);
  });

  it('retains an in-memory session when writes are denied', () => {
    storage.setItem.mockImplementation(() => {
      throw new DOMException('Denied', 'QuotaExceededError');
    });
    const store = usePartyStore();
    store.setSession(session);
    expect(() => store.saveSession(session.inviteCode)).not.toThrow();
    expect(store.persistenceUnavailable).toBe(true);
    expect(store.loadSession()).toEqual(session);
    expect(store.playerId).toBe(session.playerId);
  });

  it('can log out even if storage reads and removals are denied', () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('Denied');
    });
    storage.removeItem.mockImplementation(() => {
      throw new Error('Denied');
    });
    const store = usePartyStore();
    expect(store.loadSession()).toBeNull();
    store.setSession(session);
    expect(() => store.clearSession()).not.toThrow();
    expect(store.loadSession()).toBeNull();
    expect(store.playerId).toBeNull();
  });

  it('does not resurrect stale data after removeItem fails', () => {
    values.set('platform.party.session', JSON.stringify(session));
    const store = usePartyStore();
    expect(store.loadSession()).toEqual(session);
    storage.removeItem.mockImplementation(() => {
      throw new Error('Denied');
    });
    store.clearSession();
    expect(store.loadSession()).toBeNull();
    expect(store.persistenceUnavailable).toBe(false);
  });

  it.each([
    '{bad',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...session, resumeToken: 123 }),
    JSON.stringify({ ...session, inviteCode: '../path' }),
    JSON.stringify({ ...session, playerName: '' }),
    JSON.stringify({ ...session, playerId: {} }),
  ])('rejects malformed persisted data: %s', (value) => {
    values.set('platform.party.session', value);
    expect(usePartyStore().loadSession()).toBeNull();
  });

  it('clears a persistence warning after a successful write', () => {
    const store = usePartyStore();
    store.setSession(session);
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('Denied');
    });
    store.saveSession(session.inviteCode);
    expect(store.persistenceUnavailable).toBe(true);
    store.saveSession(session.inviteCode);
    expect(store.persistenceUnavailable).toBe(false);
  });
});
