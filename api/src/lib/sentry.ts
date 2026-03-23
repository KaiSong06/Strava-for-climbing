import * as Sentry from '@sentry/node';
import type { Express } from 'express';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  tracesSampleRate: 0.2,
  environment: process.env['NODE_ENV'] ?? 'development',
  // Only capture errors in production to avoid noise in dev
  enabled: !!process.env['SENTRY_DSN'],
});

export function setupExpressErrorHandler(app: Express): void {
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
