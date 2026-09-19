import type { RoundResult } from '../../../core/src/types';

export interface RoundScoreInput {
  agentId: string;
  artistIds: string[];
  voteLeaders: string[];
  agentGuessCorrect: boolean | null;
}

export interface RoundScoreOutput {
  agentCaught: boolean;
  scoreDeltas: Record<string, number>;
}

/** Returns every uniquely most-voted target; ties intentionally remain ties. */
export function getVoteLeaders(votes: Map<string, string>): string[] {
  const counts = new Map<string, number>();
  for (const targetId of votes.values()) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const highest = Math.max(...counts.values());
  return [...counts.entries()]
    .filter(([, count]) => count === highest)
    .map(([playerId]) => playerId)
    .sort();
}

/**
 * Calculates one round's points without mutating room state.
 * A tied top vote does not count as catching the agent.
 */
export function computeRoundScore(input: RoundScoreInput): RoundScoreOutput {
  const scoreDeltas: Record<string, number> = {};
  for (const playerId of [input.agentId, ...input.artistIds]) scoreDeltas[playerId] = 0;

  const agentCaught = input.voteLeaders.length === 1 && input.voteLeaders[0] === input.agentId;
  if (!agentCaught || input.agentGuessCorrect === true) {
    scoreDeltas[input.agentId] = 2;
  } else {
    for (const artistId of input.artistIds) scoreDeltas[artistId] = 1;
  }

  return { agentCaught, scoreDeltas };
}

export function toRoundResult(input: RoundScoreInput & { topic: string }): RoundResult {
  const result = computeRoundScore(input);
  return {
    agentId: input.agentId,
    agentCaught: result.agentCaught,
    agentGuessed: result.agentCaught ? input.agentGuessCorrect : null,
    topic: input.topic,
    scoreDeltas: result.scoreDeltas,
  };
}
