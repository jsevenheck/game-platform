/**
 * Number of reverse-proxy hops between the client and this server that are
 * trusted to have correctly appended their own observed peer address to
 * `X-Forwarded-For`. The deployed topology (see docker-compose.yml) is a
 * single Traefik hop in front of this container, so the default is 1.
 * Override with `TRUST_PROXY_HOPS` for a different deployment shape.
 */
export function getTrustedProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS;
  if (raw === undefined) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 1;
}

/**
 * Resolve the real client IP from a raw `X-Forwarded-For` header value and
 * the direct TCP peer address, trusting exactly `hops` reverse-proxy hops.
 *
 * `X-Forwarded-For` is a comma-separated list where each hop *appends* the
 * peer address it observed — so an entry a client sent itself is always
 * among the leftmost values, and is never distinguishable from a real one
 * by position alone unless you know how many hops to trust. Trusting
 * exactly `hops` proxies means: the address `hops` positions in from the
 * right is the first one no client could have forged (every hop after it
 * was appended by a proxy we trust to report its own peer correctly).
 * `hops=1` (this deployment: one Traefik hop) is the rightmost entry;
 * `hops=0` ignores the header entirely and trusts only the raw socket peer.
 *
 * This must stay the single point of client-IP resolution for anything
 * that isn't already using Express's own `req.ip` (which performs the same
 * calculation once `app.set('trust proxy', hops)` is configured) — e.g.
 * the raw Socket.IO/engine.io connection handler, which has no `req.ip`.
 */
export function resolveClientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  hops: number = getTrustedProxyHops()
): string {
  if (hops > 0 && forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      const index = Math.max(parts.length - hops, 0);
      const candidate = parts[index];
      if (candidate) return candidate;
    }
  }
  return remoteAddress || 'unknown';
}
