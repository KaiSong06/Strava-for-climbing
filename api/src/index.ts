import 'dotenv/config';
import './lib/sentry';
import express, { Express } from 'express';
import cors from 'cors';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { defaultLimiter } from './middleware/rateLimiter';
import { setupExpressErrorHandler } from './lib/sentry';

export interface CreateAppOptions {
  /** Skip the default global rate limiter (useful for tests that don't want 100/min caps). */
  disableRateLimit?: boolean;
}

/**
 * Build the Express app without binding to a port.
 * Exported so tests can mount it in supertest without starting an HTTP listener.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  const corsOrigin = process.env['CORS_ORIGIN'];
  app.use(
    cors({
      origin: corsOrigin ? corsOrigin.split(',') : true,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Secret'],
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (!options.disableRateLimit) {
    app.use(defaultLimiter);
  }

  app.use('/', router);

  // Must be registered after routes
  setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env['PORT'] ?? 3001;
  app.listen(PORT, () => {
    console.log(`[api] listening on port ${PORT}`);
  });
}
