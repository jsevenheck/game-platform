export const IS_E2E = process.env.E2E_TESTS === '1';

/** Soft UI prompt timer — server never auto-submits on this. */
export const GUESS_TIMER_MS = IS_E2E ? 2_000 : 60_000;
