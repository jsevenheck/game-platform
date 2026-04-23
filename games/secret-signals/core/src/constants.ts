import type { AssassinPenaltyMode, TeamColor } from './types';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 24;

export const GRID_SIZE = 5;
export const BOARD_SIZE = GRID_SIZE * GRID_SIZE; // 25
export const MIN_NEUTRAL_CARDS = 3;
export const MIN_TEAM_PLAYERS = 2;

export const TEAM_DEFINITIONS = [
  { color: 'red', name: 'Red', hex: '#ef4444', textHex: '#ffffff' },
  { color: 'blue', name: 'Blue', hex: '#3b82f6', textHex: '#ffffff' },
  { color: 'green', name: 'Green', hex: '#22c55e', textHex: '#ffffff' },
  { color: 'orange', name: 'Orange', hex: '#f97316', textHex: '#ffffff' },
] as const satisfies ReadonlyArray<{
  color: TeamColor;
  name: string;
  hex: string;
  textHex: string;
}>;

export const TEAM_COLORS = TEAM_DEFINITIONS.map((team) => team.color) as readonly TeamColor[];

export const TEAM_NAME_BY_COLOR = Object.fromEntries(
  TEAM_DEFINITIONS.map((team) => [team.color, team.name])
) as Record<TeamColor, string>;

export const TEAM_HEX_BY_COLOR = Object.fromEntries(
  TEAM_DEFINITIONS.map((team) => [team.color, team.hex])
) as Record<TeamColor, string>;

export const TEAM_TEXT_HEX_BY_COLOR = Object.fromEntries(
  TEAM_DEFINITIONS.map((team) => [team.color, team.textHex])
) as Record<TeamColor, string>;

export const MIN_TEAMS = 2;
export const MAX_TEAMS = TEAM_COLORS.length;

export const ASSASSIN_PENALTY_MODES: readonly AssassinPenaltyMode[] = [
  'instant-loss',
  'elimination',
] as const;

export const DEFAULT_ASSASSIN_PENALTY_MODE: AssassinPenaltyMode = 'instant-loss';

/**
 * Card distribution lookup table.
 * Each entry: perTeam[] (first team gets +1) + 1 assassin + neutral = 25.
 */
const LEGACY_CARD_DISTRIBUTION: Record<number, { perTeam: number[]; neutral: number }> = {
  2: { perTeam: [9, 8], neutral: 7 },
  3: { perTeam: [6, 5, 5], neutral: 8 },
  4: { perTeam: [5, 4, 4, 4], neutral: 7 },
};

export function getActiveTeamColors(teamCount: number): TeamColor[] {
  return TEAM_COLORS.slice(0, teamCount) as TeamColor[];
}

export function getMinimumPlayersForTeamCount(teamCount: number): number {
  return Math.max(MIN_PLAYERS, teamCount * MIN_TEAM_PLAYERS);
}

export function getCardDistribution(teamCount: number): { perTeam: number[]; neutral: number } {
  const legacy = LEGACY_CARD_DISTRIBUTION[teamCount];
  if (legacy) {
    return legacy;
  }

  if (teamCount < MIN_TEAMS || teamCount > MAX_TEAMS) {
    throw new Error(`Unsupported team count: ${teamCount}`);
  }

  const baseTargetCount = Math.max(
    1,
    Math.floor((BOARD_SIZE - 1 - MIN_NEUTRAL_CARDS - 1) / teamCount)
  );
  const perTeam = Array.from({ length: teamCount }, (_, index) =>
    index === 0 ? baseTargetCount + 1 : baseTargetCount
  );
  const teamCardCount = perTeam.reduce((sum, count) => sum + count, 0);
  const neutral = BOARD_SIZE - 1 - teamCardCount;

  if (neutral < MIN_NEUTRAL_CARDS) {
    throw new Error(`Unable to generate board for ${teamCount} teams`);
  }

  return { perTeam, neutral };
}

export const MAX_SIGNAL_NUMBER = 25;
export const MIN_SIGNAL_NUMBER = 0; // 0 = unlimited guesses
