import 'dotenv/config';
import './lib/sentry';
import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { defaultLimiter } from './middleware/rateLimiter';
import { setupExpressErrorHandler } from './lib/sentry';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

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
app.use(defaultLimiter);

app.use('/', router);

// Must be registered after routes
setupExpressErrorHandler(app);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
});

export { app };
