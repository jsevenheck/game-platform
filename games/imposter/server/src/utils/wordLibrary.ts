import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_WORD_LIBRARY,
  DEFAULT_WORD_LIBRARY_EN,
  WORD_MAX_LENGTH,
} from '../../../core/src/constants';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';

const wordLogger = createComponentLogger('imposter-word-library');
type WordLocale = 'en' | 'de';

/** Resolve beside the source/compiled game module so dev and dist use the same asset. */
function bundledWordsFile(locale: WordLocale): string {
  return path.resolve(__dirname, `../../data/words.${locale}.txt`);
}

/**
 * Where submitted words are stored. Set `IMPOSTER_WORDS_DIR` to a mounted volume so custom
 * words survive container replacement; otherwise they are appended beside the bundled asset.
 */
function wordsFile(locale: WordLocale): string {
  const dir = process.env.IMPOSTER_WORDS_DIR?.trim();
  return dir ? path.resolve(dir, `words.${locale}.txt`) : bundledWordsFile(locale);
}

function defaultWords(locale: WordLocale): string[] {
  return locale === 'de' ? [...DEFAULT_WORD_LIBRARY] : [...DEFAULT_WORD_LIBRARY_EN];
}

/**
 * Hard cap on player-submitted words in the shared, process-global library.
 * Without this, `persistWord` (called from every room's `submitWord` handler)
 * grows the in-memory cache — and, when persistence is enabled, the on-disk
 * file — without bound, since custom words are never removed. Bundled words
 * do not count against the cap, so filling it never crowds them out.
 */
export const WORD_LIBRARY_MAX_SIZE = 2000;

/** When false, submitted words are kept in-memory only (for multi-instance deployments
 * where a local file would diverge across processes). Defaults to true. */
const PERSIST_ENABLED = (() => {
  const raw = process.env.IMPOSTER_PERSIST_WORDS;
  if (raw === undefined) return true;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
})();

const cache = new Map<WordLocale, string[]>();
const bundledCache = new Map<WordLocale, Set<string>>();

function bundledWordSet(locale: WordLocale): Set<string> {
  let words = bundledCache.get(locale);
  if (!words) {
    let list: string[];
    try {
      list = readWordFile(bundledWordsFile(locale));
    } catch {
      list = [];
    }
    words = new Set((list.length > 0 ? list : defaultWords(locale)).map((w) => w.toLowerCase()));
    bundledCache.set(locale, words);
  }
  return words;
}

function submittedWordCount(locale: WordLocale, words: string[]): number {
  const bundled = bundledWordSet(locale);
  return words.filter((w) => !bundled.has(w.toLowerCase())).length;
}

function readWordFile(file: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  return content
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length <= WORD_MAX_LENGTH);
}

function loadFromFile(locale: WordLocale): string[] {
  // The configured store wins; the bundled list seeds a fresh (empty) volume.
  for (const file of [wordsFile(locale), bundledWordsFile(locale)]) {
    try {
      const words = readWordFile(file);
      if (words.length > 0) return words;
    } catch {
      // try the next candidate
    }
  }
  return defaultWords(locale);
}

function library(locale: WordLocale): string[] {
  let words = cache.get(locale);
  if (!words) {
    words = loadFromFile(locale);
    cache.set(locale, words);
  }
  return words;
}

/** Returns a copy of the global word library for a locale, loading from disk on first call. */
export function getGlobalWordLibrary(locale: WordLocale = 'en'): string[] {
  return [...library(locale)];
}

/**
 * Saves a new word to the global library and appends it to the file.
 * No-ops if the word already exists (case-insensitive).
 */
export function persistWord(word: string, locale: WordLocale = 'en'): void {
  const words = library(locale);
  const lower = word.toLowerCase();
  if (words.some((w) => w.toLowerCase() === lower)) return;
  const submitted = submittedWordCount(locale, words);
  if (submitted >= WORD_LIBRARY_MAX_SIZE) {
    wordLogger.warn(
      { size: submitted, limit: WORD_LIBRARY_MAX_SIZE, locale },
      'word library at capacity — dropping new submitted word'
    );
    return;
  }
  words.push(word);
  if (!PERSIST_ENABLED) return;
  try {
    const file = wordsFile(locale);
    if (fs.existsSync(file)) {
      fs.appendFileSync(file, '\n' + word, 'utf8');
    } else {
      // First submission into a fresh store: seed it with the full current library.
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, words.join('\n'), 'utf8');
    }
  } catch (err) {
    wordLogger.warn(
      { err },
      'failed to persist submitted word to disk — word is in-memory only for this process'
    );
  }
}
