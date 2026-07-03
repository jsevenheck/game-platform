import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_WORD_LIBRARY, WORD_MAX_LENGTH } from '../../../core/src/constants';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';

const wordLogger = createComponentLogger('imposter-word-library');
const WORDS_FILE = path.resolve(process.cwd(), 'server', 'data', 'words.txt');

/** When false, submitted words are kept in-memory only (for multi-instance deployments
 * where a local file would diverge across processes). Defaults to true. */
const PERSIST_ENABLED = (() => {
  const raw = process.env.IMPOSTER_PERSIST_WORDS;
  if (raw === undefined) return true;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
})();

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
  if (!PERSIST_ENABLED) return;
  try {
    fs.appendFileSync(WORDS_FILE, '\n' + word, 'utf8');
  } catch (err) {
    wordLogger.warn(
      { err },
      'failed to persist submitted word to disk — word is in-memory only for this process'
    );
  }
}
