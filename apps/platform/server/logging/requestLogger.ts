import type { IncomingMessage, ServerResponse } from 'http';
import type { LevelWithSilent } from 'pino';
import pinoHttp, { type HttpLogger } from 'pino-http';
import { createComponentLogger, createRequestId } from './logger';

function normalizeRequestPath(url: string | undefined): string {
  return (url ?? '').split('?', 1)[0] ?? '';
}

const STATIC_ASSET_PATH_RE =
  /\.(?:css|js|mjs|cjs|map|json|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|webp|avif|txt)$/i;

export function shouldIgnoreHttpRequest(req: Pick<IncomingMessage, 'url'>): boolean {
  return normalizeRequestPath(req.url) === '/health';
}

export function isStaticAssetRequest(req: Pick<IncomingMessage, 'url'>): boolean {
  return STATIC_ASSET_PATH_RE.test(normalizeRequestPath(req.url));
}

export function resolveHttpLogLevel(
  req: Pick<IncomingMessage, 'url'>,
  res: Pick<ServerResponse, 'statusCode'>,
  error?: Error
): LevelWithSilent {
  if (shouldIgnoreHttpRequest(req)) return 'silent';
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  if (isStaticAssetRequest(req)) return 'silent';
  return 'info';
}

const httpLogger = createComponentLogger('http');

export function createRequestLogger(
  parent = httpLogger
): HttpLogger<IncomingMessage, ServerResponse> {
  return pinoHttp<IncomingMessage, ServerResponse>({
    logger: parent,
    quietReqLogger: true,
    customAttributeKeys: {
      reqId: 'requestId',
    },
    autoLogging: {
      ignore: shouldIgnoreHttpRequest,
    },
    genReqId(req, res) {
      const requestId = createRequestId(req.headers['x-request-id']);
      res.setHeader('X-Request-Id', requestId);
      return requestId;
    },
    customLogLevel: (req, res, error) => resolveHttpLogLevel(req, res, error),
    customSuccessMessage(_req, res) {
      return res.statusCode >= 400 ? 'request completed with warning' : 'request completed';
    },
    customErrorMessage() {
      return 'request failed';
    },
  });
}

export const requestLogger = createRequestLogger();
