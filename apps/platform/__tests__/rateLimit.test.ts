import {
  checkFixedWindowRateLimit,
  pruneExpiredRateLimitEntries,
  createSocketRateLimiter,
  type RateLimitRecord,
} from '../server/observability/rateLimit';

describe('checkFixedWindowRateLimit', () => {
  it('allows calls up to max within a window, then rejects', () => {
    const map = new Map<string, RateLimitRecord>();
    const options = { windowMs: 1_000, max: 3 };
    const now = 1_000_000;

    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(true);
    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(true);
    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(true);
    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(false);
  });

  it('resets the count once the window has elapsed', () => {
    const map = new Map<string, RateLimitRecord>();
    const options = { windowMs: 1_000, max: 1 };
    const now = 1_000_000;

    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(true);
    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(false);
    // Still within the window — still rejected.
    expect(checkFixedWindowRateLimit(map, 'a', options, now + 999)).toBe(false);
    // Window has elapsed — allowed again.
    expect(checkFixedWindowRateLimit(map, 'a', options, now + 1_001)).toBe(true);
  });

  it('tracks each key independently', () => {
    const map = new Map<string, RateLimitRecord>();
    const options = { windowMs: 1_000, max: 1 };
    const now = 1_000_000;

    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(true);
    expect(checkFixedWindowRateLimit(map, 'a', options, now)).toBe(false);
    // A different key has its own independent budget.
    expect(checkFixedWindowRateLimit(map, 'b', options, now)).toBe(true);
  });
});

describe('pruneExpiredRateLimitEntries', () => {
  it('removes only entries whose window has elapsed', () => {
    const map = new Map<string, RateLimitRecord>([
      ['expired', { count: 1, resetAt: 1_000 }],
      ['fresh', { count: 1, resetAt: 3_000 }],
    ]);

    pruneExpiredRateLimitEntries(map, 2_000);

    expect(map.has('expired')).toBe(false);
    expect(map.has('fresh')).toBe(true);
  });
});

describe('createSocketRateLimiter', () => {
  it('enforces its own independent window/max and keys by the id passed to check()', () => {
    const limiter = createSocketRateLimiter({ windowMs: 1_000, max: 2 });

    expect(limiter.check('socket-1')).toBe(true);
    expect(limiter.check('socket-1')).toBe(true);
    expect(limiter.check('socket-1')).toBe(false);
    // A different socket id is unaffected by socket-1's usage.
    expect(limiter.check('socket-2')).toBe(true);
  });

  it('two independently created limiters do not share state', () => {
    const a = createSocketRateLimiter({ windowMs: 1_000, max: 1 });
    const b = createSocketRateLimiter({ windowMs: 1_000, max: 1 });

    expect(a.check('same-key')).toBe(true);
    expect(a.check('same-key')).toBe(false);
    // b has never seen 'same-key' before — its own budget is untouched.
    expect(b.check('same-key')).toBe(true);
  });
});
