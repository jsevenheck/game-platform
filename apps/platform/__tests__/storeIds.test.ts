import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * All game UIs share the platform's single Pinia instance, so two stores with the same id
 * would resolve to the same store object when the player switches games without a reload.
 */
describe('Pinia store ids', () => {
  const gamesDir = join(__dirname, '../../../games');
  const ids: string[] = [];
  for (const game of readdirSync(gamesDir)) {
    try {
      const source = readFileSync(join(gamesDir, game, 'ui-vue/src/stores/game.ts'), 'utf8');
      for (const match of source.matchAll(/defineStore\(\s*'([^']+)'/g)) ids.push(match[1]);
    } catch {
      // game without a store
    }
  }

  it('finds the stores of all games', () => {
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  it('are unique across games', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
