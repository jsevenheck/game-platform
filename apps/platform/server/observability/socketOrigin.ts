import type { IncomingMessage } from 'node:http';

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/** Exact browser-origin allowlist, independent of Host/X-Forwarded-Host. */
export function createSocketOriginPolicy(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.SOCKET_ALLOWED_ORIGINS;
  const entries =
    configured !== undefined
      ? configured
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : env.NODE_ENV === 'production'
        ? []
        : DEVELOPMENT_ORIGINS;
  const origins = entries.map((entry) => {
    const url = new URL(entry);
    if (!['http:', 'https:'].includes(url.protocol) || entry !== url.origin) {
      throw new Error('SOCKET_ALLOWED_ORIGINS must contain exact HTTP(S) origins');
    }
    return url.origin;
  });
  const allowed = new Set(origins);

  function accepts(origin: string | undefined): boolean {
    // Native clients have no Origin. This is admission control, not
    // authentication: party/game tokens and rate limits still apply to them.
    return origin === undefined || allowed.has(origin);
  }

  return {
    origins,
    allowRequest: (
      request: IncomingMessage,
      callback: (error: string | null, allowed: boolean) => void
    ) => callback(null, accepts(request.headers.origin)),
    accepts,
  };
}
