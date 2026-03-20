import { customAlphabet } from 'nanoid';
import {
  MIN_PLAYERS as BASE_MIN_PLAYERS,
  MAX_PLAYERS as BASE_MAX_PLAYERS,
  DEFAULT_DISCUSSION_DURATION_MS as BASE_DEFAULT_DISCUSSION_DURATION_MS,
  GUESS_TIMEOUT_MS as BASE_GUESS_TIMEOUT_MS,
} from '../../../core/src/constants';

export const PORT = process.env.PORT ?? 3001;
export const IS_E2E = process.env.E2E_TESTS === '1';

// Timing constants — shortened in E2E to keep tests fast
export const DISCUSSION_DURATION_MS = IS_E2E ? 2_000 : BASE_DEFAULT_DISCUSSION_DURATION_MS;
export const GUESS_TIMEOUT_MS = IS_E2E ? 3_000 : BASE_GUESS_TIMEOUT_MS;

export const MIN_PLAYERS = BASE_MIN_PLAYERS;
export const MAX_PLAYERS = BASE_MAX_PLAYERS;
export const MAX_PLAYER_NAME_LENGTH = 32;

// nanoid generators
export const ROOM_CODE = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
export const PLAYER_ID = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
export const RESUME_TOKEN = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);
