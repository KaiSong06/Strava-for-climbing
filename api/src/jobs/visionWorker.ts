/**
 * Stub vision worker — simulates the async pipeline so the full UI flow works end-to-end.
 *
 * Phase 4b: replace this file with a real HTTP call to the Python FastAPI service.
 * The job payload (VisionJobData) and upload table updates must stay identical.
 *
 * Run: cd api && npm run worker:vision
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import { redisConnection, VisionJobData } from './queue';
import { pool } from '../db/pool';

const worker = new Worker<VisionJobData>(
  'vision',
  async (job) => {
    const { uploadId } = job.data;

    // 1. Mark as processing
    await pool.query(
      `UPDATE uploads SET processing_status = 'processing'::processing_status WHERE id = $1`,
      [uploadId],
    );

    // 2. Simulate processing time
    await new Promise<void>((resolve) => setTimeout(resolve, 3_000));

    // 3. Generate fake hold_vector (20 random floats in [0, 1])
    const holdVector = Array.from({ length: 20 }, () => Math.random());

    // 4. Update upload with stub results
    await pool.query(
      `UPDATE uploads
       SET processing_status = 'awaiting_confirmation'::processing_status,
           similarity_score   = 0.50,
           hold_vector        = $2::jsonb
       WHERE id = $1`,
      [uploadId, JSON.stringify(holdVector)],
    );

    console.log(`[vision-stub] Processed upload ${uploadId}`);
  },
  { connection: redisConnection },
);

worker.on('failed', (job, err) => {
  console.error(`[vision-stub] Job ${job?.id ?? '?'} failed:`, err.message);
});

console.log('[vision-stub] Worker started, listening on queue "vision"');
