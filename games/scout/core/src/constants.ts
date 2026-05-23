export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const DECK_SIZE = 45;
export const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Room cleanup timers (mirrors existing games)
export const ROOM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const ROOM_ENDED_CLEANUP_MS = 60 * 60 * 1000;
