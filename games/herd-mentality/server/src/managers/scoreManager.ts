import type { AnswerGroup, ServerRoom } from '../../../core/src/types';
import { groupAnswers } from '../../../core/src/rules';

export function computeGroups(room: ServerRoom): AnswerGroup[] {
  return groupAnswers(
    [...room.answers.entries()].map(([playerId, answer]) => ({ playerId, answer }))
  );
}
