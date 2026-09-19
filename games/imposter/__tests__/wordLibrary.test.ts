// Persistence disabled for this suite: process.cwd() during a monorepo-root
// test run doesn't resolve to the game's own data directory, and these
// tests only care about in-memory cache behavior, not the on-disk file.
// `IMPOSTER_PERSIST_WORDS` is read once at module load time, so the module
// under test must be imported dynamically *after* the env var is set —
// static `import` statements are hoisted above this file's own top-level
// code by the ES module spec and would run before the assignment below.
process.env.IMPOSTER_PERSIST_WORDS = 'false';

let getGlobalWordLibrary: typeof import('../server/src/utils/wordLibrary').getGlobalWordLibrary;
let persistWord: typeof import('../server/src/utils/wordLibrary').persistWord;
let WORD_LIBRARY_MAX_SIZE: typeof import('../server/src/utils/wordLibrary').WORD_LIBRARY_MAX_SIZE;

beforeAll(async () => {
  const mod = await import('../server/src/utils/wordLibrary');
  getGlobalWordLibrary = mod.getGlobalWordLibrary;
  persistWord = mod.persistWord;
  WORD_LIBRARY_MAX_SIZE = mod.WORD_LIBRARY_MAX_SIZE;
});

describe('wordLibrary', () => {
  it('adds a new unique word to the shared library', () => {
    const before = getGlobalWordLibrary().length;
    persistWord(`UniqueWord-${Date.now()}`);
    expect(getGlobalWordLibrary().length).toBe(before + 1);
  });

  it('does not add a duplicate word (case-insensitive)', () => {
    const word = `DupeWord-${Date.now()}`;
    persistWord(word);
    const afterFirst = getGlobalWordLibrary().length;
    persistWord(word.toLowerCase());
    expect(getGlobalWordLibrary().length).toBe(afterFirst);
  });

  // F16 regression: the shared word library previously grew without bound —
  // every submitted word from every room, for the lifetime of the process,
  // was appended with no cap.
  it('stops growing once WORD_LIBRARY_MAX_SIZE is reached', () => {
    // Fill the library up to the cap.
    while (getGlobalWordLibrary().length < WORD_LIBRARY_MAX_SIZE) {
      persistWord(`FillerWord-${getGlobalWordLibrary().length}`);
    }
    expect(getGlobalWordLibrary().length).toBe(WORD_LIBRARY_MAX_SIZE);

    persistWord(`OneWordTooMany-${Date.now()}`);

    expect(getGlobalWordLibrary().length).toBe(WORD_LIBRARY_MAX_SIZE);
  });
});
