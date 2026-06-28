import {
  createParty,
  getParty,
  getPartyByInviteCode,
  getPartyBySocket,
  registerSocket,
  unregisterSocket,
  deleteParty,
  schedulePartyCleanup,
  clearPartyCleanup,
  partyToView,
  setPartyPublic,
  connectedMemberCount,
  isJoinablePublicParty,
} from '../server/party/partyStore';

vi.mock('nanoid', () => {
  let counter = 0;
  return {
    nanoid: (size?: number) => `id-${size ?? 0}-${++counter}`,
  };
});

describe('partyStore', () => {
  // Track created partyIds for cleanup
  const createdPartyIds: string[] = [];

  function createTestParty(hostName = 'Host', socketId = 'sock-1') {
    const result = createParty('player-1', hostName, socketId);
    createdPartyIds.push(result.party.partyId);
    return result;
  }

  afterEach(() => {
    for (const id of createdPartyIds) {
      deleteParty(id);
    }
    createdPartyIds.length = 0;
    vi.useRealTimers();
  });

  it('creates a party with correct initial state', () => {
    const { party, hostResumeToken } = createTestParty();

    expect(party.status).toBe('lobby');
    expect(party.hostPlayerId).toBe('player-1');
    expect(party.members.size).toBe(1);
    expect(party.members.get('player-1')?.name).toBe('Host');
    expect(party.members.get('player-1')?.connected).toBe(true);
    expect(party.selectedGameId).toBeNull();
    expect(party.activeMatch).toBeNull();
    expect(hostResumeToken).toBeTruthy();
  });

  it('looks up party by invite code (case-insensitive)', () => {
    const { party } = createTestParty();
    const code = party.inviteCode;

    expect(getPartyByInviteCode(code)).toBe(party);
    expect(getPartyByInviteCode(code.toLowerCase())).toBe(party);
  });

  it('looks up party by socket id', () => {
    const { party } = createTestParty('Host', 'sock-lookup');

    expect(getPartyBySocket('sock-lookup')).toBe(party);
    expect(getPartyBySocket('unknown')).toBeUndefined();
  });

  it('registerSocket / unregisterSocket updates mappings', () => {
    const { party } = createTestParty('Host', 'sock-a');

    registerSocket('sock-b', party.partyId);
    expect(getPartyBySocket('sock-b')).toBe(party);

    unregisterSocket('sock-b');
    expect(getPartyBySocket('sock-b')).toBeUndefined();
  });

  it('deleteParty removes all indexes', () => {
    const { party } = createTestParty('Host', 'sock-del');
    const partyId = party.partyId;
    const code = party.inviteCode;

    deleteParty(partyId);
    // Remove from tracking since we deleted manually
    createdPartyIds.pop();

    expect(getParty(partyId)).toBeUndefined();
    expect(getPartyByInviteCode(code)).toBeUndefined();
    expect(getPartyBySocket('sock-del')).toBeUndefined();
  });

  it('partyToView strips resumeToken from members', () => {
    const { party } = createTestParty();
    const view = partyToView(party);

    expect(view.members).toHaveLength(1);
    expect(view.members[0]).not.toHaveProperty('resumeToken');
    expect(view.members[0].playerId).toBe('player-1');
    expect(view.members[0].name).toBe('Host');
  });

  describe('schedulePartyCleanup', () => {
    it('deletes party after timeout when all disconnected', () => {
      vi.useFakeTimers();
      const { party } = createTestParty('Host', 'sock-gc');
      const partyId = party.partyId;

      // Mark everyone disconnected
      party.members.get('player-1')!.connected = false;
      party.members.get('player-1')!.socketId = null;
      unregisterSocket('sock-gc');

      schedulePartyCleanup(partyId);

      // Not deleted yet
      expect(getParty(partyId)).toBeDefined();

      // Advance past the 30-minute timeout
      vi.advanceTimersByTime(30 * 60 * 1000 + 1);

      expect(getParty(partyId)).toBeUndefined();
      // Already cleaned, remove from tracking
      createdPartyIds.pop();
    });

    it('does not delete party if someone reconnected', () => {
      vi.useFakeTimers();
      const { party } = createTestParty('Host', 'sock-gc2');
      const partyId = party.partyId;

      party.members.get('player-1')!.connected = false;
      schedulePartyCleanup(partyId);

      // Simulate reconnect
      party.members.get('player-1')!.connected = true;

      vi.advanceTimersByTime(30 * 60 * 1000 + 1);

      // Party should still exist since member reconnected
      expect(getParty(partyId)).toBeDefined();
    });

    it('clearPartyCleanup cancels the scheduled deletion', () => {
      vi.useFakeTimers();
      const { party } = createTestParty('Host', 'sock-gc3');
      const partyId = party.partyId;

      party.members.get('player-1')!.connected = false;
      schedulePartyCleanup(partyId);
      clearPartyCleanup(partyId);

      vi.advanceTimersByTime(30 * 60 * 1000 + 1);

      expect(getParty(partyId)).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Public listing helpers
  // ────────────────────────────────────────────────────────────────
  describe('public listing', () => {
    it('new party defaults to private with null publicListedAt', () => {
      const { party } = createTestParty();
      expect(party.isPublic).toBe(false);
      expect(party.publicListedAt).toBeNull();
      expect(partyToView(party).isPublic).toBe(false);
      expect(partyToView(party).publicListedAt).toBeNull();
    });

    it('setPartyPublic(true) sets a timestamp; setPartyPublic(false) clears it', () => {
      const { party } = createTestParty();
      setPartyPublic(party, true);
      expect(party.isPublic).toBe(true);
      expect(party.publicListedAt).toBeTypeOf('number');
      const ts = party.publicListedAt!;
      setPartyPublic(party, false);
      expect(party.isPublic).toBe(false);
      expect(party.publicListedAt).toBeNull();
      // Re-listing updates the timestamp.
      setPartyPublic(party, true);
      expect(party.publicListedAt!).toBeGreaterThanOrEqual(ts);
    });

    it('setPartyPublic is a no-op when the value is unchanged', () => {
      const { party } = createTestParty();
      setPartyPublic(party, true);
      const ts = party.publicListedAt!;
      setPartyPublic(party, true);
      expect(party.publicListedAt).toBe(ts);
    });

    it('isJoinablePublicParty requires opt-in, lobby status, and connected members', () => {
      const { party } = createTestParty();
      // Private lobby with a connected host: not joinable.
      expect(isJoinablePublicParty(party)).toBe(false);

      setPartyPublic(party, true);
      expect(isJoinablePublicParty(party)).toBe(true);

      // No connected members: not joinable.
      party.members.get('player-1')!.connected = false;
      expect(isJoinablePublicParty(party)).toBe(false);

      // Back online but not in lobby: not joinable.
      party.members.get('player-1')!.connected = true;
      party.status = 'in-match';
      expect(isJoinablePublicParty(party)).toBe(false);
    });

    it('connectedMemberCount counts only connected members', () => {
      const { party } = createTestParty();
      expect(connectedMemberCount(party)).toBe(1);
      party.members.get('player-1')!.connected = false;
      expect(connectedMemberCount(party)).toBe(0);
    });
  });
});
