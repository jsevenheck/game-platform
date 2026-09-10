import type { Question } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const DEFAULT_TOTAL_ROUNDS = 5;
/** Keep an empty room briefly so transient disconnects can resume safely. */
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const DEFAULT_QUESTIONS: Question[] = [
  { id: 'q-001', text: 'In welchem Jahr fiel die Berliner Mauer?', answer: 1989 },
  { id: 'q-002', text: 'Wie viele Planeten hat unser Sonnensystem?', answer: 8 },
  {
    id: 'q-003',
    text: 'Welche Geschwindigkeit (km/h) erreicht ein Gepard im Sprint?',
    answer: 120,
  },
  { id: 'q-004', text: 'Wie hoch (in Metern) ist der Eiffelturm?', answer: 330 },
  { id: 'q-005', text: 'Wie viele Knochen hat ein erwachsener Mensch?', answer: 206 },
  { id: 'q-006', text: 'In welchem Jahr wurde das World Wide Web öffentlich?', answer: 1991 },
  { id: 'q-007', text: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?', answer: 11 },
  {
    id: 'q-008',
    text: 'Welche Temperatur (°C) hat kochendes Wasser auf Meeresniveau?',
    answer: 100,
  },
  { id: 'q-009', text: 'Wie viele Bundesländer hat Deutschland?', answer: 16 },
  { id: 'q-010', text: 'Wie viele Seiten hat ein standardmäßiges Kartenspiel?', answer: 52 },
];

/** Safety clamp for a single guess to prevent absurd values from breaking math. */
export const GUESS_VALUE_LIMIT = 1e9;

/** Minimum visible span when all guesses are equal (guess ± 1). */
export const MIN_DISPLAY_SPAN = 2;
