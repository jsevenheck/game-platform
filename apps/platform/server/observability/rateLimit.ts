export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiter. Returns `true` when the request is allowed (and
 * counted), `false` when the window's `max` has been exceeded.
 *
 * The map is owned by the caller so each limiter keeps its own key namespace
 * and lifecycle (e.g. keyed by socket id, ip, etc.). Prune expired entries
 * periodically with {@link pruneExpiredRateLimitEntries}.
 */
export function checkFixedWindowRateLimit(
  map: Map<string, RateLimitRecord>,
  key: string,
  options: { windowMs: number; max: number },
  now: number = Date.now()
): boolean {
  const record = map.get(key);
  if (!record || now > record.resetAt) {
    map.set(key, { count: 1, resetAt: now + options.windowMs });
    return true;
  }
  if (record.count >= options.max) {
    return false;
  }
  record.count += 1;
  return true;
}

/** Remove expired entries from a rate-limit map. Safe to call on an interval. */
export function pruneExpiredRateLimitEntries(
  map: Map<string, RateLimitRecord>,
  now: number = Date.now()
): void {
  for (const [key, record] of map) {
    if (now > record.resetAt) {
      map.delete(key);
    }
  }
}

export interface SocketRateLimiter {
  /** Returns `true` when the call is allowed under the limit (and counts it). */
  check(key: string): boolean;
}

/**
 * Convenience wrapper around {@link checkFixedWindowRateLimit} /
 * {@link pruneExpiredRateLimitEntries} for the common case: a per-socket
 * rate limit on one or more in-match gameplay events, owned by one game
 * module. Handles the map + self-pruning interval (unref'd so it never
 * keeps the process alive) so each game doesn't have to hand-roll that
 * boilerplate — call this once per limiter at module scope and share the
 * returned instance across every event it should bound.
 */
export function createSocketRateLimiter(options: {
  windowMs: number;
  max: number;
}): SocketRateLimiter {
  const map = new Map<string, RateLimitRecord>();
  const pruneInterval = setInterval(() => pruneExpiredRateLimitEntries(map), 60_000);
  pruneInterval.unref?.();
  return {
    check(key: string): boolean {
      return checkFixedWindowRateLimit(map, key, options);
    },
  };
}
