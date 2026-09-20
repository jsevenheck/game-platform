import { describe, expect, it } from 'vitest';
import { getWordList } from '../server/src/data/words';
import { generateBoard } from '../server/src/managers/boardManager';

describe('secret-signals word lists', () => {
  for (const locale of ['en', 'de'] as const) {
    it(`${locale} list has enough unique uppercase single words`, () => {
      const words = getWordList(locale);
      expect(words.length).toBeGreaterThanOrEqual(400);
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) {
        expect(word, word).toBe(word.toUpperCase());
        expect(word.trim(), word).toBe(word);
      }
    });
  }

  it('generates the board from the requested locale', () => {
    const de = new Set(getWordList('de'));
    const en = new Set(getWordList('en'));
    const { board } = generateBoard(2, ['red', 'blue'], 'de');
    expect(board.every((card) => de.has(card.word))).toBe(true);
    const { board: enBoard } = generateBoard(2, ['red', 'blue'], 'en');
    expect(enBoard.every((card) => en.has(card.word))).toBe(true);
  });
});
