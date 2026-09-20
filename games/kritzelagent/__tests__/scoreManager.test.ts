import { describe, expect, it } from 'vitest';
import { computeRoundScore, getVoteLeaders } from '../server/src/managers/scoreManager';

describe('getVoteLeaders', () => {
  it('returns the sole player with the most votes', () => {
    const votes = new Map([
      ['p1', 'p2'],
      ['p2', 'p2'],
      ['p3', 'p1'],
    ]);
    expect(getVoteLeaders(votes)).toEqual(['p2']);
  });

  it('returns all tied leaders so a tie cannot falsely catch the agent', () => {
    const votes = new Map([
      ['p1', 'p2'],
      ['p2', 'p1'],
      ['p3', 'p3'],
      ['p4', 'p1'],
      ['p5', 'p2'],
    ]);
    expect(getVoteLeaders(votes)).toEqual(['p1', 'p2']);
  });
});

describe('computeRoundScore', () => {
  it('awards the agent two points when they are not uniquely caught', () => {
    expect(
      computeRoundScore({
        agentId: 'p1',
        artistIds: ['p2', 'p3'],
        voteLeaders: ['p2', 'p3'],
        agentGuessCorrect: null,
      })
    ).toEqual({
      agentCaught: false,
      scoreDeltas: { p1: 2, p2: 0, p3: 0 },
    });
  });

  it('awards the agent two points when caught but guessing the topic correctly', () => {
    expect(
      computeRoundScore({
        agentId: 'p1',
        artistIds: ['p2', 'p3'],
        voteLeaders: ['p1'],
        agentGuessCorrect: true,
      })
    ).toEqual({
      agentCaught: true,
      scoreDeltas: { p1: 2, p2: 0, p3: 0 },
    });
  });

  it('awards every artist one point when the caught agent misses', () => {
    expect(
      computeRoundScore({
        agentId: 'p1',
        artistIds: ['p2', 'p3'],
        voteLeaders: ['p1'],
        agentGuessCorrect: false,
      })
    ).toEqual({
      agentCaught: true,
      scoreDeltas: { p1: 0, p2: 1, p3: 1 },
    });
  });
});
