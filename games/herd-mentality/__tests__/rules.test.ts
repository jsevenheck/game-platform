import { describe, expect, it } from 'vitest';
import { MAX_ANSWER_LENGTH } from '@shared/constants';
import { groupAnswers, normalizeAnswer, resolveRound } from '@shared/rules';

describe('Herd Mentality answer rules', () => {
  it('normalizes Unicode, whitespace, and case deterministically', () => {
    expect(normalizeAnswer('  Äpfel   und  Birnen ')).toBe('äpfel und birnen');
    expect(normalizeAnswer('Ａpfel')).toBe('apfel');
  });
  it('rejects empty and overlong answers', () => {
    expect(normalizeAnswer('   ')).toBeNull();
    expect(normalizeAnswer('x'.repeat(MAX_ANSWER_LENGTH + 1))).toBeNull();
  });
  it('groups matching normalized answers and orders largest groups first', () => {
    const groups = groupAnswers([
      { playerId: 'a', answer: ' Pizza ' },
      { playerId: 'b', answer: 'pizza' },
      { playerId: 'c', answer: 'Salat' },
    ]);
    expect(groups).toMatchObject([
      { answer: 'pizza', count: 2, playerIds: ['a', 'b'] },
      { answer: 'salat', count: 1, playerIds: ['c'] },
    ]);
  });
  it('assigns Pink Cow only to a single unmatched player beside a majority', () => {
    expect(
      resolveRound([
        { playerId: 'a', answer: 'Pizza' },
        { playerId: 'b', answer: 'pizza' },
        { playerId: 'c', answer: 'Salat' },
      ]).pinkCowPlayerId
    ).toBe('c');
    expect(
      resolveRound([
        { playerId: 'a', answer: 'Pizza' },
        { playerId: 'b', answer: 'Salat' },
        { playerId: 'c', answer: 'Suppe' },
      ]).pinkCowPlayerId
    ).toBeNull();
  });
});
