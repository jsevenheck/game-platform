export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 18;

export const DEFAULT_TARGET_SCORE = 200;
export const MIN_TARGET_SCORE = 50;
export const MAX_TARGET_SCORE = 500;
export const TARGET_SCORE_STEP = 25;

export const FLIP7_BONUS = 15;
export const FLIP7_CARD_COUNT = 7;

// Room cleanup timers (mirrors blackout constants)
export const ROOM_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ROOM_ENDED_CLEANUP_MS = 60 * 60 * 1000; // 1 hour
export const ROUND_END_DISPLAY_MS = 4_000; // 4 seconds between rounds

// Deck composition
export const DECK_MAX_NUMBER = 12;
// Number cards: value N appears N times (except 0 which appears once)
// +2, +4, +6, +8, +10 flat modifier cards (1 each)
export const MODIFIER_ADD_VALUES = [2, 4, 6, 8, 10] as const;
// x2 multiplier: 1 card
// Freeze, Flip Three, Second Chance: 3 each
export const ACTION_CARD_COUNT = 3;
