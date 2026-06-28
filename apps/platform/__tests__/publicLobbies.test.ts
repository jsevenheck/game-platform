import {
  createParty,
  deleteParty,
  setPartyPublic,
  clearPartyCleanup,
} from '../server/party/partyStore';
import { getJoinablePublicPartiesSnapshot } from '../server/party/publicLobbies';

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
        definition: { id: 'test-game', name: 'Test Game', minPlayers: 2, maxPlayers: 8 },
        registerServer: vi.fn(),
        cleanupMatch: vi.fn(),
      };
    }
    return undefined;
  },
}));

describe('publicLobbies snapshot', () => {
  const createdPartyIds: string[] = [];

  function createTestParty(hostName = 'Host', socketId = 'sock-1') {
    const result = createParty('player-1', hostName, socketId);
    createdPartyIds.push(result.party.partyId);
    return result;
  }

  afterEach(() => {
    for (const id of createdPartyIds) {
      clearPartyCleanup(id);
      deleteParty(id);
    }
    createdPartyIds.length = 0;
    vi.useRealTimers();
  });

  it('excludes private parties', () => {
    createTestParty();
    expect(getJoinablePublicPartiesSnapshot()).toHaveLength(0);
  });

  it('excludes public parties with no connected members', () => {
    const { party } = createTestParty();
    setPartyPublic(party, true);
    party.members.get('player-1')!.connected = false;
    expect(getJoinablePublicPartiesSnapshot()).toHaveLength(0);
  });

  it('excludes public parties not in lobby', () => {
    const { party } = createTestParty();
    setPartyPublic(party, true);
    party.status = 'in-match';
    expect(getJoinablePublicPartiesSnapshot()).toHaveLength(0);
  });

  it('includes a public lobby with connected members', () => {
    const { party } = createTestParty();
    setPartyPublic(party, true);
    const snap = getJoinablePublicPartiesSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].inviteCode).toBe(party.inviteCode);
    expect(snap[0].status).toBe('lobby');
    expect(snap[0].connectedPlayers).toBe(1);
    expect(snap[0].gameName).toBeNull();
    expect(snap[0].minPlayers).toBeNull();
  });

  it('includes game metadata when a game is selected', () => {
    const { party } = createTestParty();
    party.selectedGameId = 'test-game';
    setPartyPublic(party, true);
    const snap = getJoinablePublicPartiesSnapshot();
    expect(snap[0].gameId).toBe('test-game');
    expect(snap[0].gameName).toBe('Test Game');
    expect(snap[0].minPlayers).toBe(2);
    expect(snap[0].maxPlayers).toBe(8);
  });

  it('deleted parties no longer appear in the snapshot', () => {
    const { party } = createTestParty();
    setPartyPublic(party, true);
    expect(getJoinablePublicPartiesSnapshot()).toHaveLength(1);
    deleteParty(party.partyId);
    createdPartyIds.pop();
    expect(getJoinablePublicPartiesSnapshot()).toHaveLength(0);
  });

  it('sorts newest-first by listedAt', () => {
    const a = createTestParty('A', 'sock-a');
    setPartyPublic(a.party, true);
    // Force a later timestamp for the second party.
    const originalNow = Date.now;
    const base = Date.now();
    Date.now = () => base + 1000;
    const b = createTestParty('B', 'sock-b');
    setPartyPublic(b.party, true);
    Date.now = originalNow;

    const snap = getJoinablePublicPartiesSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap[0].inviteCode).toBe(b.party.inviteCode);
    expect(snap[1].inviteCode).toBe(a.party.inviteCode);
  });
});
