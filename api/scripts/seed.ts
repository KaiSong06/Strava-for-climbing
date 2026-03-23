import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

async function seed(): Promise<void> {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../db/seeds/seed.sql'),
    'utf8',
  );
  await pool.query(sql);
  console.log('[seed] done');
  await pool.end();
}

seed().catch((err) => {
  console.error('[seed] error', err);
  process.exit(1);
});
