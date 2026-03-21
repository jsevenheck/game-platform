import { TEAM_HEX_BY_COLOR, TEAM_NAME_BY_COLOR, TEAM_TEXT_HEX_BY_COLOR } from '@shared/constants';
import type { CardType, TeamColor } from '@shared/types';

export const TEAM_HEX = TEAM_HEX_BY_COLOR;
export const TEAM_NAME = TEAM_NAME_BY_COLOR;
export const TEAM_TEXT_HEX = TEAM_TEXT_HEX_BY_COLOR;

export const CARD_HEX_BY_TYPE: Record<CardType | 'neutral' | 'assassin', string> = {
  ...TEAM_HEX_BY_COLOR,
  neutral: '#78716c',
  assassin: '#18181b',
};

export function getCardTextHex(type: CardType | null): string {
  if (!type) return '#e4e4e7';
  if (type === 'neutral' || type === 'assassin') return '#ffffff';
  return TEAM_TEXT_HEX[type as TeamColor];
}
