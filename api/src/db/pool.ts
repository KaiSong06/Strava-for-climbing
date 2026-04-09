import { Pool } from 'pg';
import { logger } from '../lib/logger';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL env var is required');
}

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env['DB_SSL'] === 'false' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  logger.error('pg idle client error', {
    error: err instanceof Error ? err.message : String(err),
  });
});
