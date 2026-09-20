import { describe, expect, it } from 'vitest';
import { en as platformEn } from '../src/i18n/messages/en';
import { de as platformDe } from '../src/i18n/messages/de';

type Tree = { [key: string]: string | Tree };

const bundles: Record<string, { en: Tree; de: Tree }> = {
  platform: { en: platformEn as Tree, de: platformDe as Tree },
};

const GAMES = [
  'blackout',
  'imposter',
  'secret-signals',
  'flip7',
  'scout',
  'estimate',
  'kritzelagent',
  'herd-mentality',
];

const gameModules = import.meta.glob<{ en?: Tree; de?: Tree }>(
  '../../../games/*/ui-vue/src/i18n/{en,de}.ts',
  { eager: true }
);

for (const game of GAMES) {
  const base = `../../../games/${game}/ui-vue/src/i18n`;
  const en = gameModules[`${base}/en.ts`]?.en;
  const de = gameModules[`${base}/de.ts`]?.de;
  if (en && de) bundles[game] = { en, de };
}

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** `{name}` / `{0}` placeholders, sorted, so translations must use the same variables. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('i18n message parity', () => {
  it('has a bundle for every game', () => {
    expect(Object.keys(bundles).sort()).toEqual(['platform', ...GAMES].sort());
  });

  for (const [name, { en, de }] of Object.entries(bundles)) {
    describe(name, () => {
      const flatEn = flatten(en);
      const flatDe = flatten(de);

      it('has identical keys in en and de', () => {
        expect([...flatDe.keys()].sort()).toEqual([...flatEn.keys()].sort());
      });

      it('uses the same placeholders in en and de', () => {
        for (const [key, message] of flatEn) {
          expect(placeholders(flatDe.get(key) ?? ''), key).toEqual(placeholders(message));
        }
      });

      it('has no empty messages', () => {
        for (const [key, message] of [...flatEn, ...flatDe]) {
          expect(message.trim(), key).not.toBe('');
        }
      });
    });
  }
});
