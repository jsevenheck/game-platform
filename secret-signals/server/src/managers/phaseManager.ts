import { getActiveTeamColors } from '../../../core/src/constants';
import type { Room, TeamColor } from '../../../core/src/types';
import { generateBoard } from './boardManager';

export function transitionToPlaying(room: Room): void {
  room.phase = 'playing';
  const activeColors = getActiveTeamColors(room.teamCount);
  const startingTeamIndex = room.nextStartingTeamIndex % activeColors.length;
  const turnOrder = [
    ...activeColors.slice(startingTeamIndex),
    ...activeColors.slice(0, startingTeamIndex),
  ];

  const { board, teams } = generateBoard(room.teamCount, turnOrder);
  room.board = board;
  room.teams = teams;
  room.turnOrder = turnOrder;
  room.currentTurnTeam = turnOrder[0];
  room.turnPhase = 'giving-signal';
  room.currentSignal = null;
  room.log = [];
  room.winnerTeam = null;
  room.winningTeams = [];
  room.focusedCards = [];
  room.nextStartingTeamIndex = (startingTeamIndex + 1) % activeColors.length;
}

export function transitionToEnded(room: Room, winningTeams: TeamColor[]): void {
  room.phase = 'ended';
  room.winnerTeam = winningTeams[0] ?? null;
  room.winningTeams = [...winningTeams];
  room.turnPhase = null;
  room.currentSignal = null;
  room.focusedCards = [];

  for (const card of room.board) {
    card.revealed = true;
  }
}

export function transitionToLobby(room: Room): void {
  room.phase = 'lobby';
  room.board = [];
  room.teams = [];
  room.currentTurnTeam = null;
  room.turnPhase = null;
  room.currentSignal = null;
  room.log = [];
  room.winnerTeam = null;
  room.winningTeams = [];
  room.focusedCards = [];
  room.turnOrder = getActiveTeamColors(room.teamCount);
}

export function validateTeamSetup(room: Room): { valid: boolean; error?: string } {
  const connectedPlayers = Object.values(room.players).filter((player) => player.connected);
  const activeColors = getActiveTeamColors(room.teamCount);

  for (const player of connectedPlayers) {
    if (!player.team || !player.role) {
      return { valid: false, error: `${player.name} is not fully assigned to a team and role` };
    }
    if (!activeColors.includes(player.team)) {
      return { valid: false, error: `${player.name} is assigned to an invalid team` };
    }
  }

  for (const color of activeColors) {
    const teamPlayers = connectedPlayers.filter((player) => player.team === color);
    const directors = teamPlayers.filter((player) => player.role === 'director');
    const agents = teamPlayers.filter((player) => player.role === 'agent');

    if (directors.length !== 1) {
      return {
        valid: false,
        error: `Team ${color} needs exactly 1 Director (has ${directors.length})`,
      };
    }
    if (agents.length < 1) {
      return {
        valid: false,
        error: `Team ${color} needs at least 1 Agent`,
      };
    }
  }

  return { valid: true };
}
