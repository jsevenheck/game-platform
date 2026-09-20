import { MAX_ANSWER_LENGTH } from './constants';
import type { AnswerEntry, AnswerGroup, RoundResult } from './types';

export function normalizeAnswer(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und');
  if (normalized.length === 0 || normalized.length > MAX_ANSWER_LENGTH) return null;
  return normalized;
}

export function groupAnswers(answers: AnswerEntry[]): AnswerGroup[] {
  const groups = new Map<string, AnswerGroup>();
  for (const entry of answers) {
    const answer = normalizeAnswer(entry.answer);
    if (!answer) continue;
    const existing = groups.get(answer);
    if (existing) {
      existing.playerIds.push(entry.playerId);
      existing.count += 1;
    } else {
      groups.set(answer, {
        answer,
        playerIds: [entry.playerId],
        playerNames: [],
        count: 1,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer));
}

/**
 * Returns the unique most-common answer. A tied top count is not a majority,
 * so no group receives a cow in that case.
 */
export function getMajorityGroup(groups: AnswerGroup[]): AnswerGroup | null {
  const [top, runnerUp] = groups;
  if (!top || top.count < 2 || runnerUp?.count === top.count) return null;
  return top;
}

export function resolveRound(answers: AnswerEntry[]): RoundResult {
  const groups = groupAnswers(answers);
  const majorityGroup = getMajorityGroup(groups);
  const unmatchedPlayerIds = groups
    .filter((group) => group.count === 1)
    .flatMap((group) => group.playerIds);
  const pinkCowPlayerId =
    majorityGroup && unmatchedPlayerIds.length === 1 ? unmatchedPlayerIds[0]! : null;
  return {
    groups,
    majorityAnswer: majorityGroup?.answer ?? null,
    unmatchedPlayerIds,
    pinkCowPlayerId,
    winnerIds: [],
  };
}
