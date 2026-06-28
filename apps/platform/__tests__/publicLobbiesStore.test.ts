import { createPinia, setActivePinia } from 'pinia';
import { usePublicLobbiesStore, type JoinablePartyView } from '../src/stores/publicLobbies';

function makeParty(inviteCode: string, listedAt: number): JoinablePartyView {
  return {
    inviteCode,
    gameId: null,
    gameName: null,
    minPlayers: null,
    maxPlayers: null,
    connectedPlayers: 1,
    status: 'lobby',
    listedAt,
  };
}

describe('publicLobbiesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('applyUpdate sorts newest-first and sets state ready', () => {
    const store = usePublicLobbiesStore();
    store.applyUpdate([makeParty('OLD', 100), makeParty('NEW', 999)]);
    expect(store.state).toBe('ready');
    expect(store.parties.map((p) => p.inviteCode)).toEqual(['NEW', 'OLD']);
    expect(store.isEmpty).toBe(false);
    expect(store.lastUpdated).toBeTypeOf('number');
  });

  it('isEmpty is true only when ready with no parties', () => {
    const store = usePublicLobbiesStore();
    expect(store.isEmpty).toBe(false); // state is 'idle'
    store.applyUpdate([]);
    expect(store.isEmpty).toBe(true);
  });

  it('setError preserves existing parties and sets error state', () => {
    const store = usePublicLobbiesStore();
    store.applyUpdate([makeParty('AAA', 1)]);
    store.setError('rate_limited');
    expect(store.state).toBe('error');
    expect(store.error).toBe('rate_limited');
    expect(store.parties.map((p) => p.inviteCode)).toEqual(['AAA']);
  });

  it('reset clears everything', () => {
    const store = usePublicLobbiesStore();
    store.applyUpdate([makeParty('AAA', 1)]);
    store.reset();
    expect(store.parties).toHaveLength(0);
    expect(store.state).toBe('idle');
    expect(store.error).toBeNull();
  });
});
