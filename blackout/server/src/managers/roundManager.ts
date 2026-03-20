import type { Room, RoundResult } from '../../../core/src/types';
import { getUnusedPrompt } from './categoryManager';

export function startNewRound(room: Room, readerId: string): void {
  const roundNumber = room.roundHistory.length + 1;
  const { category, task, letter } = getUnusedPrompt(
    room.usedCategoryLetterPairs,
    room.language,
    room.excludedLetters
  );
  room.usedCategoryLetterPairs.add(`${category.id}:${task.id}:${letter ?? '-'}`);

  room.currentRound = {
    roundNumber,
    category,
    task,
    letter,
    readerId,
    winnerId: null,
    revealed: false,
  };
}

export function revealCategory(room: Room): void {
  if (!room.currentRound) return;
  room.currentRound.revealed = true;
}

export function rerollCurrentPrompt(room: Room): void {
  const round = room.currentRound;
  if (!round) return;

  const { category, task, letter } = getUnusedPrompt(
    room.usedCategoryLetterPairs,
    room.language,
    room.excludedLetters
  );
  room.usedCategoryLetterPairs.add(`${category.id}:${task.id}:${letter ?? '-'}`);

  round.category = category;
  round.task = task;
  round.letter = letter;
  round.winnerId = null;
  round.revealed = false;
}

export function selectWinner(room: Room, winnerId: string): void {
  if (!room.currentRound) return;
  room.currentRound.winnerId = winnerId;
}

export function finalizeRound(room: Room): RoundResult | null {
  const round = room.currentRound;
  if (!round) return null;

  const result: RoundResult = {
    roundNumber: round.roundNumber,
    category: round.category,
    task: round.task,
    letter: round.letter,
    readerId: round.readerId,
    winnerId: round.winnerId,
  };

  room.roundHistory.push(result);
  return result;
}

export function getNextReader(room: Room): string | null {
  if (room.hostId && room.players[room.hostId]) return room.hostId;
  const playerIds = Object.keys(room.players);
  return playerIds[0] ?? null;
}

export function getRandomReader(room: Room): string {
  const playerIds = Object.keys(room.players);
  if (playerIds.length === 0) return '';
  return playerIds[Math.floor(Math.random() * playerIds.length)]!;
}

export function isLastRound(room: Room): boolean {
  return room.roundHistory.length >= room.maxRounds;
}
