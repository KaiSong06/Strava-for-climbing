/**
 * Structured logger — single source of truth for server-side logging.
 *
 * Backed by Sentry's native Log API (@sentry/node v10+). When `SENTRY_DSN`
 * is unset, log calls are effectively no-ops (init runs with enabled=false),
 * so consumers can call `logger.info/warn/error` unconditionally.
 *
 * Prefer structured attributes over string interpolation:
 *   logger.info('Upload matched', { uploadId, problemId, score })
 *
 * Do NOT log secrets, tokens, passwords, full headers, or request bodies.
 */
import { Sentry } from './sentry';

export const logger = Sentry.logger;
