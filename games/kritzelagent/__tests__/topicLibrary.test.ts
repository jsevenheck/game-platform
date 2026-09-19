import { describe, expect, it } from 'vitest';
import {
  __resetTopicFileReaderForTests,
  __resetTopicLibraryCacheForTests,
  __setTopicFileReaderForTests,
  getTopicLibrary,
  pickRandomTopics,
  topicMatchesGuess,
} from '../server/src/utils/topicLibrary';

describe('topicLibrary', () => {
  it('loads valid CSV rows and ignores comments and malformed rows', () => {
    __setTopicFileReaderForTests(
      () =>
        '\uFEFFcategory,topic\nTiere,"Roter Fuchs"\n# ignored\n,Ohne Kategorie\nEssen,\nNatur,"Vulkan, aktiv"\n'
    );

    expect(getTopicLibrary()).toEqual([
      { id: 't-001', category: 'Tiere', topic: 'Roter Fuchs' },
      { id: 't-002', category: 'Natur', topic: 'Vulkan, aktiv' },
    ]);
  });

  it('falls back to defaults when no valid rows exist', () => {
    __setTopicFileReaderForTests(() => 'category,topic\n,\n');
    expect(getTopicLibrary().length).toBeGreaterThan(0);
  });

  it('returns a copy and does not repeat selected topics when possible', () => {
    __setTopicFileReaderForTests(() => 'category,topic\nA,Alpha\nB,Beta\nC,Gamma\n');
    const selected = pickRandomTopics(3);
    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((topic) => topic.id)).size).toBe(3);
    selected[0]!.topic = 'mutated';
    expect(getTopicLibrary()[0]!.topic).toBe('Alpha');
  });

  it('matches guesses case-insensitively and without accent differences', () => {
    expect(topicMatchesGuess('Äpfel', 'apfel')).toBe(true);
    expect(topicMatchesGuess('  Vulkan  ', 'vulkan')).toBe(true);
    expect(topicMatchesGuess('Pinguin', 'Panda')).toBe(false);
  });

  it('restores the real reader after each test', () => {
    __resetTopicFileReaderForTests();
    __resetTopicLibraryCacheForTests();
    expect(getTopicLibrary().length).toBeGreaterThan(0);
  });
});
