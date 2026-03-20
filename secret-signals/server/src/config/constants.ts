import { customAlphabet } from 'nanoid';
import {
  MIN_PLAYERS as BASE_MIN_PLAYERS,
  MAX_PLAYERS as BASE_MAX_PLAYERS,
} from '../../../core/src/constants';

export const PORT = process.env.PORT ?? 3001;
export const IS_E2E = process.env.E2E_TESTS === '1';

export const MIN_PLAYERS = BASE_MIN_PLAYERS;
export const MAX_PLAYERS = BASE_MAX_PLAYERS;
export const MAX_PLAYER_NAME_LENGTH = 32;

// Shared id generators for server-side room and player identity.
export const ROOM_CODE = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
export const PLAYER_ID = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
export const RESUME_TOKEN = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);
