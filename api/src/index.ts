import 'dotenv/config';
import express from 'express';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

// Must be registered after routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
});

export { app };
