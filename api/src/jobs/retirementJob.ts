/**
 * Nightly retirement job — marks active problems as retired once they exceed
 * their gym's default_retirement_days since first_upload_at.
 *
 * Run as a standalone process:   cd api && npm run worker:retirement
 * Or trigger via HTTP endpoint:  POST /internal/run-retirement
 */
import 'dotenv/config';
import '../lib/sentry';
import cron from 'node-cron';
import { pool } from '../db/pool';
import { logger } from '../lib/logger';

export async function runRetirement(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE problems
     SET status    = 'retired'::problem_status,
         retired_at = NOW()
     WHERE status = 'active'
       AND first_upload_at + (
         SELECT default_retirement_days FROM gyms WHERE id = problems.gym_id
       ) * INTERVAL '1 day' < NOW()`,
  );
  const retired = rowCount ?? 0;
  logger.info('retirement.run_complete', { retiredCount: retired });
  return retired;
}

// When executed directly (not imported), schedule nightly at 02:00 UTC
if (require.main === module) {
  cron.schedule('0 2 * * *', async () => {
    try {
      await runRetirement();
    } catch (err) {
      logger.error('retirement.job_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
  logger.info('retirement.worker_started', { cron: '0 2 * * *', tz: 'UTC' });
}
