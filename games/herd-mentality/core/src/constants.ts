import type { Prompt } from './types';

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;
export const DEFAULT_TOTAL_ROUNDS = 8;
export const TARGET_COWS = 8;
export const MAX_ANSWER_LENGTH = 80;
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const DEFAULT_PROMPTS: Prompt[] = [
  { id: 'p-001', text: 'Was gehört auf einen perfekten Frühstückstisch?' },
  { id: 'p-002', text: 'Welches Tier wäre ein schlechter Mitbewohner?' },
  { id: 'p-003', text: 'Was nimmt man auf eine einsame Insel mit?' },
  { id: 'p-004', text: 'Welcher Snack verschwindet auf einer Party zuerst?' },
  { id: 'p-005', text: 'Was ist die beste Ausrede, um zu spät zu kommen?' },
  { id: 'p-006', text: 'Welcher Gegenstand liegt in fast jeder Küchenschublade?' },
  { id: 'p-007', text: 'Was macht einen Urlaub sofort besser?' },
  { id: 'p-008', text: 'Welches Getränk passt zu einem Spieleabend?' },
  { id: 'p-009', text: 'Was sollte man niemals zum ersten Date mitbringen?' },
  { id: 'p-010', text: 'Welche Farbe sieht man besonders oft bei Autos?' },
  { id: 'p-011', text: 'Was darf bei einem Picknick nicht fehlen?' },
  { id: 'p-012', text: 'Welcher Beruf wäre als Superheld besonders nützlich?' },
];
