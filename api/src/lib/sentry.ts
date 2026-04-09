import * as Sentry from '@sentry/node';
import type { Express } from 'express';

Sentry.init({
  dsn: process.env['SENTRY_DSN'],
  tracesSampleRate: 0.2,
  environment: process.env['NODE_ENV'] ?? 'development',
  // Only capture errors in production to avoid noise in dev
  enabled: !!process.env['SENTRY_DSN'],
  // Enable the Sentry Log API (Sentry.logger.info/warn/error/fmt).
  enableLogs: true,
  integrations: [
    // Any stray console.warn/console.error that slips past lint is automatically
    // promoted to a structured Sentry log event.
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
  ],
});

export function setupExpressErrorHandler(app: Express): void {
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry };

/** Re-export of Sentry.logger — prefer `import { logger } from './logger'` in consumers. */
export const logger = Sentry.logger;
