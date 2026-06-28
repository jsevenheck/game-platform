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
