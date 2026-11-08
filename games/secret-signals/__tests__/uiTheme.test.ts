import { describe, expect, it } from 'vitest';
import {
  CARD_HEX_BY_TYPE,
  getCardTextHex,
  TEAM_HEX,
  TEAM_TEXT_HEX,
} from '../ui-vue/src/lib/teamTheme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('Secret Signals card and team contrast', () => {
  it.each(Object.keys(CARD_HEX_BY_TYPE) as Array<keyof typeof CARD_HEX_BY_TYPE>)(
    '%s cards retain readable ink without visible ownership labels',
    (type) => {
      expect(contrast(CARD_HEX_BY_TYPE[type], getCardTextHex(type))).toBeGreaterThanOrEqual(4.5);
    }
  );
  it('uses readable ink on the unrevealed paper surface', () => {
    expect(contrast('#f2e8d5', getCardTextHex(null))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(Object.keys(TEAM_HEX) as Array<'red' | 'blue' | 'green' | 'orange'>)(
    '%s setup controls meet text contrast',
    (team) => {
      expect(contrast(TEAM_HEX[team], TEAM_TEXT_HEX[team])).toBeGreaterThanOrEqual(4.5);
    }
  );
});
