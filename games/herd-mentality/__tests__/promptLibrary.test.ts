import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetPromptLibraryCacheForTests,
  __setPromptFileReaderForTests,
  getPromptLibrary,
  pickRandomPrompts,
} from '../server/src/utils/promptLibrary';

beforeEach(() => __setPromptFileReaderForTests(() => 'prompt\n"One"\n# ignored\n\n"Two"\n'));
afterEach(() => {
  __resetPromptLibraryCacheForTests();
  __setPromptFileReaderForTests();
});

describe('prompt library', () => {
  it('loads valid prompts and skips comments and blanks', () => {
    expect(getPromptLibrary().map((prompt) => prompt.text)).toEqual(['One', 'Two']);
  });
  it('returns no more than the requested number without mutating the cache', () => {
    expect(pickRandomPrompts(1)).toHaveLength(1);
    expect(getPromptLibrary()).toHaveLength(2);
  });
});
