import type { Topic } from './types';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 12;
export const DEFAULT_TOTAL_ROUNDS = 5;
export const DRAWING_TURNS_PER_PLAYER = 2;
export const MAX_STROKE_POINTS = 80;
export const MAX_COORDINATE = 1;
export const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const DEFAULT_TOPICS: Topic[] = [
  { id: 'default-001', category: 'Tiere', topic: 'Pinguin' },
  { id: 'default-002', category: 'Essen', topic: 'Spaghetti' },
  { id: 'default-003', category: 'Orte', topic: 'Leuchtturm' },
  { id: 'default-004', category: 'Berufe', topic: 'Feuerwehrmann' },
  { id: 'default-005', category: 'Natur', topic: 'Vulkan' },
  { id: 'default-006', category: 'Fahrzeuge', topic: 'Fahrrad' },
  { id: 'default-007', category: 'Haushalt', topic: 'Staubsauger' },
  { id: 'default-008', category: 'Märchen', topic: 'Drache' },
  { id: 'default-009', category: 'Sport', topic: 'Fußball' },
  { id: 'default-010', category: 'Reisen', topic: 'Zelt' },
];
