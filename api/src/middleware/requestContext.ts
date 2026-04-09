import { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from '../lib/requestContext';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Trusts an incoming `x-request-id` header when it looks like a reasonable
 * correlation id (<=128 chars, printable ASCII). Otherwise generates a fresh
 * UUID v4. The chosen id is:
 *   - stored on `req.id`
 *   - echoed back in the response `x-request-id` header
 *   - bound to AsyncLocalStorage for the remainder of the request
 */
const REQUEST_ID_MAX_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._\-:]+$/;

function pickRequestId(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw && raw.length <= REQUEST_ID_MAX_LENGTH && SAFE_REQUEST_ID.test(raw)) {
    return raw;
  }
  return randomUUID();
}

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestId = pickRequestId(req.headers['x-request-id']);
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  runWithRequestContext({ requestId }, () => {
    next();
  });
};
