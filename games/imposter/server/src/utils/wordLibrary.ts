import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_WORD_LIBRARY, WORD_MAX_LENGTH } from '../../../core/src/constants';

const WORDS_FILE = path.resolve(process.cwd(), 'server', 'data', 'words.txt');

let cache: string[] | null = null;

function loadFromFile(): string[] {
  try {
    const content = fs.readFileSync(WORDS_FILE, 'utf8');
    const words = content
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && w.length <= WORD_MAX_LENGTH);
    return words.length > 0 ? words : [...DEFAULT_WORD_LIBRARY];
  } catch {
    return [...DEFAULT_WORD_LIBRARY];
  }
}

/** Returns a copy of the global word library, loading from disk on first call. */
export function getGlobalWordLibrary(): string[] {
  if (!cache) cache = loadFromFile();
  return [...cache];
}

/**
 * Saves a new word to the global library and appends it to the file.
 * No-ops if the word already exists (case-insensitive).
 */
export function persistWord(word: string): void {
  if (!cache) cache = loadFromFile();
  const lower = word.toLowerCase();
  if (cache.some((w) => w.toLowerCase() === lower)) return;
  cache.push(word);
  try {
    fs.appendFileSync(WORDS_FILE, '\n' + word, 'utf8');
  } catch {
    // File not writable (e.g. read-only Docker image without a mounted volume) — words
    // still work in-memory for the current server process, just won't persist across restarts.
  }
}
