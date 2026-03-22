import { Pool } from 'pg';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL env var is required');
}

export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error', err);
});
