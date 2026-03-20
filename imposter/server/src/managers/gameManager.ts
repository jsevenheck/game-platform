import type { Room, RoundResult } from '../../../core/src/types';
import {
  DEFAULT_INFILTRATOR_COUNT,
  DESCRIPTION_MAX_LENGTH,
  WORD_MAX_LENGTH,
  MIN_DISCUSSION_DURATION_MS,
  MAX_DISCUSSION_DURATION_MS,
  DISCUSSION_DURATION_STEP_MS,
  DEFAULT_DISCUSSION_DURATION_MS,
  DEFAULT_TARGET_SCORE,
  MIN_TARGET_SCORE,
  MAX_TARGET_SCORE,
} from '../../../core/src/constants';
import { getRandomInt, shuffle } from '../utils/helpers';
import { getGlobalWordLibrary } from '../utils/wordLibrary';

export function initGameState(room: Room): void {
  room.infiltratorCount = DEFAULT_INFILTRATOR_COUNT;
  room.discussionDurationMs = DEFAULT_DISCUSSION_DURATION_MS;
  room.targetScore = DEFAULT_TARGET_SCORE;
  room.secretWord = null;
  room.infiltratorIds = [];
  room.descriptionOrder = [];
  room.descriptions = {};
  room.currentDescriberId = null;
  room.votes = {};
  room.roundNumber = 0;
  room.wordLibrary = getGlobalWordLibrary();
  room.discussionEndsAt = null;
  room.revealedInfiltrators = [];
  room.infiltratorGuess = null;
  room.waitingForGuess = false;
  room.lastRoundResult = null;
  room.roundHistory = [];
}

export function setInfiltratorCount(room: Room, count: number): string | null {
  const connectedCount = Object.values(room.players).filter((player) => player.connected).length;
  if (count < 0 || count >= connectedCount) {
    return 'Infiltrator count must be between 0 and player count - 1';
  }

  room.infiltratorCount = count;
  return null;
}

export function setDiscussionDuration(room: Room, durationMs: number): string | null {
  if (
    durationMs < MIN_DISCUSSION_DURATION_MS ||
    durationMs > MAX_DISCUSSION_DURATION_MS ||
    durationMs % DISCUSSION_DURATION_STEP_MS !== 0
  ) {
    return `Discussion timer must be between ${MIN_DISCUSSION_DURATION_MS / 1000} and ${MAX_DISCUSSION_DURATION_MS / 1000} seconds`;
  }

  room.discussionDurationMs = durationMs;
  return null;
}

export function setTargetScore(room: Room, targetScore: number): string | null {
  if (targetScore < MIN_TARGET_SCORE || targetScore > MAX_TARGET_SCORE) {
    return `Target score must be between ${MIN_TARGET_SCORE} and ${MAX_TARGET_SCORE}`;
  }

  room.targetScore = targetScore;
  return null;
}

export function addWordToLibrary(room: Room, word: string): string | null {
  const trimmed = word.trim();
  if (!trimmed || trimmed.length > WORD_MAX_LENGTH) {
    return `Word must be between 1 and ${WORD_MAX_LENGTH} characters`;
  }

  const exists = room.wordLibrary.some((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    return 'Word already exists in the library';
  }

  room.wordLibrary.push(trimmed);
  return null;
}

export function startRound(room: Room): void {
  const wordIndex = getRandomInt(room.wordLibrary.length);
  room.secretWord = room.wordLibrary[wordIndex]!;

  const connectedIds = getConnectedPlayerOrder(room);
  room.descriptionOrder = getRandomDescriptionOrder(connectedIds);
  room.infiltratorIds = selectRandomInfiltrators(connectedIds, room.infiltratorCount);

  room.descriptions = {};
  room.currentDescriberId = room.descriptionOrder[0] ?? null;
  room.votes = {};
  room.discussionEndsAt = null;
  room.revealedInfiltrators = [];
  room.infiltratorGuess = null;
  room.waitingForGuess = false;
  room.lastRoundResult = null;
  room.roundNumber += 1;
  room.phase = 'description';
}

export function submitDescription(
  room: Room,
  playerId: string,
  description: string
): string | null {
  if (room.phase !== 'description') {
    return 'Not in description phase';
  }

  const player = room.players[playerId];
  if (!player || !player.connected) {
    return 'Player not found or disconnected';
  }

  if (room.descriptions[playerId] !== undefined) {
    return 'Already submitted a description';
  }

  if (room.currentDescriberId !== playerId) {
    const currentPlayer = room.currentDescriberId ? room.players[room.currentDescriberId] : null;
    return currentPlayer
      ? `Waiting for ${currentPlayer.name} to enter a clue`
      : 'It is not your turn yet';
  }

  const trimmed = description.trim();
  if (!trimmed || trimmed.length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be between 1 and ${DESCRIPTION_MAX_LENGTH} characters`;
  }

  room.descriptions[playerId] = trimmed;
  advanceDescriptionTurn(room);
  return null;
}

export function allDescriptionsSubmitted(room: Room): boolean {
  return getDescriptionOrder(room).every((playerId) => room.descriptions[playerId] !== undefined);
}

export function startDiscussion(room: Room): void {
  room.phase = 'discussion';
  room.currentDescriberId = null;
}

export function syncDescriptionTurn(room: Room): void {
  if (room.phase !== 'description') {
    return;
  }

  if (allDescriptionsSubmitted(room)) {
    startDiscussion(room);
    return;
  }

  const currentPlayer = room.currentDescriberId ? room.players[room.currentDescriberId] : null;
  if (currentPlayer?.connected && room.descriptions[currentPlayer.id] === undefined) {
    return;
  }

  if (
    currentPlayer &&
    !currentPlayer.connected &&
    room.descriptions[currentPlayer.id] === undefined
  ) {
    room.descriptions[currentPlayer.id] = '';
  }

  advanceDescriptionTurn(room);
}

export function skipCurrentDescription(room: Room): string | null {
  if (room.phase !== 'description') {
    return 'Can only skip clue turns during description phase';
  }

  if (!room.currentDescriberId) {
    return 'No active clue turn to skip';
  }

  room.descriptions[room.currentDescriberId] = '';
  advanceDescriptionTurn(room);
  return null;
}

export function startVoting(room: Room): void {
  room.phase = 'voting';
  room.votes = {};
  room.discussionEndsAt = null;
}

export function submitVote(room: Room, voterId: string, targetId: string): string | null {
  if (room.phase !== 'voting') {
    return 'Not in voting phase';
  }

  const voter = room.players[voterId];
  if (!voter || !voter.connected) {
    return 'Player not found or disconnected';
  }

  if (!room.players[targetId]) {
    return 'Target player not found';
  }

  if (voterId === targetId) {
    return 'Cannot vote for yourself';
  }

  if (room.votes[voterId] !== undefined) {
    return 'Already voted';
  }

  room.votes[voterId] = targetId;
  return null;
}

export function allVotesSubmitted(room: Room): boolean {
  return getConnectedPlayerOrder(room).every((playerId) => room.votes[playerId] !== undefined);
}

export function resolveVotes(room: Room): void {
  const tally: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
  }

  let maxVotes = 0;
  for (const count of Object.values(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  const votedOutIds = Object.keys(tally).filter((id) => tally[id] === maxVotes);
  const caughtInfiltrators = votedOutIds.filter((id) => room.infiltratorIds.includes(id));
  room.revealedInfiltrators = caughtInfiltrators;

  if (caughtInfiltrators.length > 0 && room.infiltratorIds.length > 0) {
    room.waitingForGuess = true;
    room.phase = 'reveal';
    return;
  }

  finalizeRound(room, votedOutIds, null);
  room.phase = isMatchOver(room) ? 'ended' : 'reveal';
}

export function handleInfiltratorGuess(room: Room, guess: string): string | null {
  if (room.phase !== 'reveal') {
    return 'Not in reveal phase';
  }

  if (!room.waitingForGuess) {
    return 'Not waiting for a guess';
  }

  const trimmed = guess.trim();
  if (!trimmed) {
    return 'Guess cannot be empty';
  }

  room.infiltratorGuess = trimmed;
  room.waitingForGuess = false;
  finalizeRound(room, getVotedOutIds(room), trimmed);
  room.phase = isMatchOver(room) ? 'ended' : 'reveal';
  return null;
}

export function skipGuess(room: Room): void {
  if (!room.waitingForGuess) {
    return;
  }

  room.waitingForGuess = false;
  room.infiltratorGuess = null;
  finalizeRound(room, getVotedOutIds(room), null);
  room.phase = isMatchOver(room) ? 'ended' : 'reveal';
}

export function isMatchOver(room: Room): boolean {
  return Object.values(room.players).some((player) => player.score >= room.targetScore);
}

export function resetForNewRound(room: Room): void {
  room.secretWord = null;
  room.infiltratorIds = [];
  room.descriptionOrder = [];
  room.descriptions = {};
  room.currentDescriberId = null;
  room.votes = {};
  room.discussionEndsAt = null;
  room.revealedInfiltrators = [];
  room.infiltratorGuess = null;
  room.waitingForGuess = false;
  room.lastRoundResult = null;
}

export function resetForLobby(room: Room): void {
  room.phase = 'lobby';
  room.secretWord = null;
  room.infiltratorIds = [];
  room.descriptionOrder = [];
  room.descriptions = {};
  room.currentDescriberId = null;
  room.votes = {};
  room.roundNumber = 0;
  room.discussionEndsAt = null;
  room.revealedInfiltrators = [];
  room.infiltratorGuess = null;
  room.waitingForGuess = false;
  room.lastRoundResult = null;
  room.roundHistory = [];

  for (const player of Object.values(room.players)) {
    player.score = 0;
  }
}

function getConnectedPlayerOrder(room: Room): string[] {
  return Object.values(room.players)
    .filter((player) => player.connected)
    .map((player) => player.id);
}

export function getRandomDescriptionOrder(playerIds: string[]): string[] {
  return shuffle(playerIds);
}

export function selectRandomInfiltrators(playerIds: string[], infiltratorCount: number): string[] {
  return shuffle(playerIds).slice(0, infiltratorCount);
}

function getDescriptionOrder(room: Room): string[] {
  if (room.descriptionOrder.length > 0) {
    return room.descriptionOrder;
  }

  return getConnectedPlayerOrder(room);
}

function advanceDescriptionTurn(room: Room): void {
  const nextPlayerId = getDescriptionOrder(room).find(
    (playerId) => room.descriptions[playerId] === undefined
  );

  if (nextPlayerId) {
    room.currentDescriberId = nextPlayerId;
    return;
  }

  startDiscussion(room);
}

function getVotedOutIds(room: Room): string[] {
  const tally: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
  }

  let maxVotes = 0;
  for (const count of Object.values(tally)) {
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  return Object.keys(tally).filter((id) => tally[id] === maxVotes);
}

function finalizeRound(room: Room, votedOutIds: string[], guess: string | null): void {
  const guessCorrect = guess ? guess.toLowerCase() === room.secretWord?.toLowerCase() : false;
  const allInfiltratorsCaught =
    room.infiltratorIds.length > 0 &&
    room.revealedInfiltrators.length === room.infiltratorIds.length;

  let winner: 'civilians' | 'infiltrators';
  if (room.infiltratorIds.length === 0) {
    winner = 'civilians';
  } else if (!allInfiltratorsCaught) {
    winner = 'infiltrators';
  } else if (guessCorrect) {
    winner = 'infiltrators';
  } else {
    winner = 'civilians';
  }

  if (winner === 'civilians') {
    for (const player of Object.values(room.players)) {
      if (!room.infiltratorIds.includes(player.id)) {
        player.score += 1;
      }
    }
  } else {
    for (const infiltratorId of room.infiltratorIds) {
      if (room.players[infiltratorId]) {
        room.players[infiltratorId].score += 2;
      }
    }
  }

  const result: RoundResult = {
    secretWord: room.secretWord!,
    infiltratorIds: [...room.infiltratorIds],
    votedOutIds,
    infiltratorsCaught: allInfiltratorsCaught,
    infiltratorGuess: guess,
    infiltratorGuessCorrect: guessCorrect,
    winner,
  };

  room.lastRoundResult = result;
  room.roundHistory.push(result);
}
