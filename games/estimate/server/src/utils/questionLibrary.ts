import * as fs from 'fs';
import * as path from 'path';
import { createComponentLogger } from '../../../../../apps/platform/server/logging/logger';
import { DEFAULT_QUESTIONS, GUESS_VALUE_LIMIT } from '../../../core/src/constants';
import type { Question } from '../../../core/src/types';

const questionLogger = createComponentLogger('estimate-question-library');

/** Path is resolved relative to the workspace root that the platform server runs from,
 *  matching the imposter wordLibrary convention. */
const QUESTIONS_FILE = path.resolve(process.cwd(), 'games/estimate/server/data/questions.csv');

/** File reader function — overridable in tests via __setQuestionFileReaderForTests. */
let fileReader: (filePath: string, encoding: 'utf8') => string = (p, enc) =>
  fs.readFileSync(p, enc);

let cache: Question[] | null = null;

/** Parses a single CSV line into a {text, answer} pair, or null if the line should be skipped.
 *  Handles:
 *   - leading/trailing whitespace
 *   - blank lines
 *   - '#' comment lines
 *   - quoted fields containing commas (basic CSV quoting)
 *   - BOM at start of file (stripped before splitting) */
function parseCsvLine(line: string): { text: string; answer: number } | null {
  const trimmed = line.replace(/^\uFEFF/, '').trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;

  // Match: "quoted text?",1234   OR   plain text,1234
  const match = trimmed.match(/^"((?:[^"]|"")*)",\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (match) {
    return { text: match[1]!.replace(/""/g, '"'), answer: Number(match[2]) };
  }
  const plain = trimmed.match(/^([^,]*),\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plain) {
    return { text: plain[1]!.trim(), answer: Number(plain[2]) };
  }
  return null;
}

function loadFromFile(): Question[] {
  let raw: string;
  try {
    raw = fileReader(QUESTIONS_FILE, 'utf8');
  } catch (err) {
    questionLogger.warn(
      { err, path: QUESTIONS_FILE },
      'questions.csv missing or unreadable — using DEFAULT_QUESTIONS'
    );
    return [...DEFAULT_QUESTIONS];
  }

  const lines = raw.split(/\r?\n/);
  const result: Question[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseCsvLine(lines[i]!);
    if (!parsed) {
      if (i === 0) continue; // skip header
      // blank / comment lines also skipped silently
      continue;
    }
    if (i === 0 && parsed.text === 'question') continue; // explicit header

    if (!Number.isFinite(parsed.answer)) {
      questionLogger.warn(
        { line: i + 1, raw: lines[i] },
        'question row has non-finite answer — skipped'
      );
      continue;
    }
    if (Math.abs(parsed.answer) > GUESS_VALUE_LIMIT) {
      questionLogger.warn(
        { line: i + 1, answer: parsed.answer },
        'question answer exceeds GUESS_VALUE_LIMIT — skipped'
      );
      continue;
    }
    if (parsed.text.length === 0) {
      questionLogger.warn({ line: i + 1 }, 'question row has empty text — skipped');
      continue;
    }

    result.push({
      id: `q-${String(i).padStart(3, '0')}`,
      text: parsed.text,
      answer: parsed.answer,
    });
  }

  if (result.length === 0) {
    questionLogger.warn(
      { path: QUESTIONS_FILE },
      'questions.csv produced no valid rows — using DEFAULT_QUESTIONS'
    );
    return [...DEFAULT_QUESTIONS];
  }

  return result;
}

/** Returns a copy of the question library, loading from disk on first call.
 *  Subsequent calls return a shallow copy so callers can't mutate the cache. */
export function getQuestionLibrary(): Question[] {
  if (!cache) cache = loadFromFile();
  return cache.map((q) => ({ ...q }));
}

/** Returns a random subset of `count` questions. If `count` exceeds the
 *  library size, all questions are returned. The returned array is a copy;
 *  callers may freely mutate it. */
export function pickRandomQuestions(count: number): Question[] {
  const lib = getQuestionLibrary();
  if (count <= 0 || lib.length === 0) return [];
  if (count >= lib.length) return lib.map((q) => ({ ...q }));

  // Fisher–Yates on a copy, then slice.
  const pool = lib.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count).map((q) => ({ ...q }));
}

/** Test-only: clear the in-memory cache so the next getQuestionLibrary()
 *  call re-reads the file. */
export function __resetQuestionLibraryCacheForTests(): void {
  cache = null;
}

/** Test-only: override the file reader so tests can supply in-memory CSV
 *  content without touching the real filesystem. */
export function __setQuestionFileReaderForTests(
  reader: (filePath: string, encoding: 'utf8') => string
): void {
  fileReader = reader;
  cache = null;
}

/** Test-only: restore the default file reader (real fs.readFileSync). */
export function __resetQuestionFileReaderForTests(): void {
  fileReader = (p, enc) => fs.readFileSync(p, enc);
  cache = null;
}
