import type { Card, Room, TeamColor } from '../../../core/src/types';

export interface GuessResult {
  card: Card;
  outcome: 'correct' | 'wrong-team' | 'neutral' | 'assassin';
  turnEnds: boolean;
  teamEliminated: boolean;
  gameOver: boolean;
  winners: TeamColor[] | null;
}

function clearFocusedCard(room: Room): void {
  room.focusedCards = [];
}

function clearFocusedCardAtIndex(room: Room, cardIndex: number): void {
  room.focusedCards = room.focusedCards.filter((marker) => marker.cardIndex !== cardIndex);
}

export function giveSignal(room: Room, word: string, number: number): void {
  clearFocusedCard(room);
  room.currentSignal = {
    word,
    number,
    teamColor: room.currentTurnTeam!,
    guessesUsed: 0,
  };
  room.turnPhase = 'guessing';
}

export function processGuess(room: Room, cardIndex: number, guessingTeam: TeamColor): GuessResult {
  clearFocusedCardAtIndex(room, cardIndex);
  const card = room.board[cardIndex];
  card.revealed = true;
  card.revealedBy = guessingTeam;

  const teamConfig = room.teams.find((team) => team.color === card.type);
  if (teamConfig) {
    teamConfig.revealedCount++;
  }

  room.currentSignal!.guessesUsed++;

  let outcome: GuessResult['outcome'];
  let turnEnds = false;
  let teamEliminated = false;
  let winners: TeamColor[] | null = null;

  if (card.type === guessingTeam) {
    outcome = 'correct';
    if (
      room.currentSignal!.number > 0 &&
      room.currentSignal!.guessesUsed > room.currentSignal!.number
    ) {
      turnEnds = true;
    }
  } else if (card.type === 'neutral') {
    outcome = 'neutral';
    turnEnds = true;
  } else if (card.type === 'assassin') {
    outcome = 'assassin';
    turnEnds = true;
    teamEliminated = true;

    const guessingConfig = room.teams.find((team) => team.color === guessingTeam);
    if (guessingConfig) {
      guessingConfig.eliminated = true;
    }

    if (room.assassinPenaltyMode === 'instant-loss') {
      winners = room.teams
        .filter((team) => team.color !== guessingTeam && !team.eliminated)
        .map((team) => team.color);
    }
  } else {
    outcome = 'wrong-team';
    turnEnds = true;
  }

  if (!winners) {
    winners = checkWinCondition(room);
  }

  return {
    card,
    outcome,
    turnEnds,
    teamEliminated,
    gameOver: winners !== null,
    winners,
  };
}

export function advanceToNextTeam(room: Room): void {
  clearFocusedCard(room);
  const activeTeams = room.turnOrder.filter((color) => {
    const config = room.teams.find((team) => team.color === color);
    return config && !config.eliminated;
  });

  if (activeTeams.length === 0) return;

  const currentIdx = activeTeams.indexOf(room.currentTurnTeam!);
  const nextIdx = (currentIdx + 1) % activeTeams.length;
  room.currentTurnTeam = activeTeams[nextIdx];
  room.turnPhase = 'giving-signal';
  room.currentSignal = null;
}

export function checkWinCondition(room: Room): TeamColor[] | null {
  for (const team of room.teams) {
    if (!team.eliminated && team.revealedCount >= team.targetCount) {
      return [team.color];
    }
  }

  const activeTeams = room.teams.filter((team) => !team.eliminated);
  if (activeTeams.length === 1) {
    return [activeTeams[0].color];
  }

  return null;
}

export function outcomeToEndReason(
  outcome: GuessResult['outcome'],
  maxGuessesReached: boolean
): 'correct-complete' | 'wrong-team' | 'neutral' | 'assassin' | 'max-guesses' {
  if (outcome === 'correct' && maxGuessesReached) return 'max-guesses';
  if (outcome === 'correct') return 'correct-complete';
  return outcome;
}
