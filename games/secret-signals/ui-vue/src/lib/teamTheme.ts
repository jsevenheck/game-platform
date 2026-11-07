import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR } from '@shared/constants';
import type { CardType, TeamColor } from '@shared/types';

export const TEAM_HEX = TEAM_HEX_BY_COLOR;
export const TEAM_NAME = TEAM_NAME_BY_COLOR;
export const TEAM_TEXT_HEX: Record<TeamColor, string> = {
  red: '#07171c',
  blue: '#07171c',
  green: '#07171c',
  orange: '#07171c',
};

export const CARD_HEX_BY_TYPE: Record<CardType | 'neutral' | 'assassin', string> = {
  ...TEAM_HEX_BY_COLOR,
  neutral: '#b9ac93',
  assassin: '#18181b',
};

export function getCardTextHex(type: CardType | null): string {
  // Dark ink maintains contrast on all four saturated team colors and paper.
  return type === 'assassin' ? '#f8fafc' : '#07171c';
}
