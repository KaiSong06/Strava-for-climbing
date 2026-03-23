/**
 * Nightly retirement job — marks active problems as retired once they exceed
 * their gym's default_retirement_days since first_upload_at.
 *
 * Run as a standalone process:   cd api && npm run worker:retirement
 * Or trigger via HTTP endpoint:  POST /internal/run-retirement
 */
import 'dotenv/config';
import cron from 'node-cron';
import { pool } from '../db/pool';

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
  console.log(`[retirement] retired ${retired} problem(s)`);
  return retired;
}

// When executed directly (not imported), schedule nightly at 02:00 UTC
if (require.main === module) {
  cron.schedule('0 2 * * *', async () => {
    try {
      await runRetirement();
    } catch (err) {
      console.error('[retirement] job failed:', err);
    }
  });
  console.log('[retirement] worker started — cron scheduled for 02:00 UTC daily');
}
