import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONS, GUESS_VALUE_LIMIT } from '@shared/constants';
import {
  __resetQuestionFileReaderForTests,
  __resetQuestionLibraryCacheForTests,
  __setQuestionFileReaderForTests,
  getQuestionLibrary,
  pickRandomQuestions,
} from '../server/src/utils/questionLibrary';

function mockCsv(content: string) {
  __setQuestionFileReaderForTests(() => content);
}

function throwOnRead() {
  __setQuestionFileReaderForTests(() => {
    throw new Error('ENOENT');
  });
}

describe('questionLibrary', () => {
  afterEach(() => {
    __resetQuestionLibraryCacheForTests();
    __resetQuestionFileReaderForTests();
  });

  describe('when the CSV is missing or unreadable', () => {
    beforeEach(() => {
      __resetQuestionLibraryCacheForTests();
      throwOnRead();
    });

    it('falls back to DEFAULT_QUESTIONS', () => {
      const lib = getQuestionLibrary();
      expect(lib).toEqual(DEFAULT_QUESTIONS);
      expect(lib.length).toBeGreaterThan(0);
    });

    it('returns a copy that callers can mutate without affecting the cache', () => {
      const lib = getQuestionLibrary();
      lib.pop();
      const again = getQuestionLibrary();
      expect(again.length).toBe(DEFAULT_QUESTIONS.length);
    });
  });

  describe('when the CSV loads successfully', () => {
    beforeEach(() => {
      __resetQuestionLibraryCacheForTests();
    });

    it('returns the bundled questions with parsed numeric answers', () => {
      const lib = getQuestionLibrary();
      expect(lib.length).toBeGreaterThanOrEqual(10);
      for (const q of lib) {
        expect(typeof q.text).toBe('string');
        expect(q.text.length).toBeGreaterThan(0);
        expect(typeof q.answer).toBe('number');
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.id).toMatch(/^q-\d{3}$/);
      }
    });

    it('includes the Berlin Wall 1989 question as a known-good baseline', () => {
      const lib = getQuestionLibrary();
      const berlin = lib.find((q) => q.text.includes('Berliner Mauer'));
      expect(berlin?.answer).toBe(1989);
    });

    it('handles negative decimal answers (e.g. dry ice temperature)', () => {
      const lib = getQuestionLibrary();
      const dryIce = lib.find((q) => q.text.includes('trockeneis'));
      expect(dryIce).toBeDefined();
      expect(dryIce?.answer).toBeLessThan(0);
      expect(dryIce?.answer).toBeCloseTo(-78, 5);
    });

    it('handles very large answers (speed of light)', () => {
      const lib = getQuestionLibrary();
      const light = lib.find((q) => q.text.includes('Lichtgeschwindigkeit'));
      expect(light).toBeDefined();
      expect(light!.answer).toBeGreaterThan(1e5);
    });
  });

  describe('when the CSV has malformed rows', () => {
    const validLine = '"Eine ganz normale Frage?",42';
    const validLine2 = 'Frage zwei,7';

    beforeEach(() => {
      __resetQuestionLibraryCacheForTests();
    });

    it('skips blank lines, comments, and the header row', () => {
      mockCsv(
        ['question,answer', '# a comment', '', validLine, '   ', '# another', validLine2].join('\n')
      );
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(2);
      expect(lib[0]?.text).toBe('Eine ganz normale Frage?');
      expect(lib[0]?.answer).toBe(42);
    });

    it('rejects non-numeric answer values', () => {
      mockCsv(['question,answer', '"Schlechtes Format",not-a-number', validLine].join('\n'));
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(1);
      expect(lib[0]?.answer).toBe(42);
    });

    it('falls back to DEFAULT_QUESTIONS when every row is invalid', () => {
      mockCsv(['question,answer', '"a",NaN', '"b",Infinity', '"c",'].join('\n'));
      const lib = getQuestionLibrary();
      expect(lib).toEqual(DEFAULT_QUESTIONS);
    });

    it('rejects empty question text', () => {
      // Whitespace-only text is treated as empty after trim.
      mockCsv(['question,answer', '   ,1234', validLine].join('\n'));
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(1);
      expect(lib[0]?.text).toBe('Eine ganz normale Frage?');
    });

    it('rejects answers beyond the safety limit', () => {
      const tooBig = String(GUESS_VALUE_LIMIT + 1);
      mockCsv(['question,answer', `"Too big",${tooBig}`, validLine].join('\n'));
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(1);
    });

    it('accepts finite signed and exponent numeric literals', () => {
      mockCsv(
        ['question,answer', '"Exponent",1e6', '"Signed",+7', '"Leading decimal",.5'].join('\n')
      );
      const lib = getQuestionLibrary();
      expect(lib.map((question) => question.answer)).toEqual([1_000_000, 7, 0.5]);
    });

    it('handles a UTF-8 BOM at the start of the file', () => {
      mockCsv(`\uFEFFquestion,answer\n${validLine}\n${validLine2}`);
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(2);
    });

    it('handles CRLF line endings', () => {
      mockCsv(`question,answer\r\n${validLine}\r\n${validLine2}\r\n`);
      const lib = getQuestionLibrary();
      expect(lib.length).toBe(2);
    });
  });

  describe('pickRandomQuestions', () => {
    beforeEach(() => {
      __resetQuestionLibraryCacheForTests();
    });

    it('returns the requested number of questions', () => {
      const subset = pickRandomQuestions(3);
      expect(subset.length).toBe(3);
    });

    it('returns the full library when count exceeds library size', () => {
      const lib = getQuestionLibrary();
      const subset = pickRandomQuestions(lib.length + 100);
      expect(subset.length).toBe(lib.length);
    });

    it('returns an empty array for count <= 0', () => {
      expect(pickRandomQuestions(0)).toEqual([]);
      expect(pickRandomQuestions(-5)).toEqual([]);
    });

    it('does not return duplicates (sampling without replacement)', () => {
      const lib = getQuestionLibrary();
      const subset = pickRandomQuestions(Math.min(5, lib.length));
      const ids = subset.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
