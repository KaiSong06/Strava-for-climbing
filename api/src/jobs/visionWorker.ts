/**
 * Vision worker — dequeues BullMQ jobs, calls the Python vision service,
 * runs pgvector similarity search, and updates the upload row.
 *
 * Run: cd api && npm run worker:vision
 */
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnection, VisionJobData } from './queue';
import { pool } from '../db/pool';
import * as pushService from '../services/pushService';
import { uploadBuffer } from '../services/storage';

/* istanbul ignore next -- startup env guard, exercised only when module is entry-point */
if (!process.env['VISION_SERVICE_URL']) {
  throw new Error('VISION_SERVICE_URL env var is required');
}
const VISION_SERVICE_URL = process.env['VISION_SERVICE_URL'];

// Mirror the thresholds from CLAUDE.md / vision/.env
const SIMILARITY_THRESHOLD_AUTO = parseFloat(process.env['SIMILARITY_THRESHOLD_AUTO'] ?? '0.92');
const SIMILARITY_THRESHOLD_CONFIRM = parseFloat(
  process.env['SIMILARITY_THRESHOLD_CONFIRM'] ?? '0.75',
);

interface VisionResult {
  hold_vector: number[];
  hold_count: number;
  wall_bbox: { x: number; y: number; w: number; h: number };
  debug_image_url: string | null;
  model_glb_base64: string | null;
}

/**
 * Processor function, exported for direct unit testing.
 * Behaviour is unchanged from the original inline processor — the BullMQ
 * worker below simply delegates to this function with the same Job shape.
 */
export async function processVisionJob(job: Job<VisionJobData>): Promise<void> {
  const { uploadId, gymId, colour, photoUrls } = job.data;

  // ── 1. Mark as processing ────────────────────────────────────────────────
  const { rows: uploadRows } = await pool.query<{ user_id: string }>(
    `UPDATE uploads SET processing_status = 'processing'::processing_status WHERE id = $1 RETURNING user_id`,
    [uploadId],
  );
  const userId = uploadRows[0]?.user_id;

  // ── 2. Call vision service ───────────────────────────────────────────────
  const response = await fetch(`${VISION_SERVICE_URL}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload_id: uploadId,
      photo_urls: photoUrls,
      colour,
      gym_id: gymId,
    }),
    signal: AbortSignal.timeout(120_000), // 2-min timeout
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Vision service responded ${response.status}: ${body}`);
  }

  const result = (await response.json()) as VisionResult;

  // ── 3. Persist hold_vector on the upload row ─────────────────────────────
  await pool.query(`UPDATE uploads SET hold_vector = $2::jsonb WHERE id = $1`, [
    uploadId,
    JSON.stringify(result.hold_vector),
  ]);

  // ── 3b. Upload GLB model to storage (if generated) ──────────────────────
  let modelUrl: string | null = null;
  if (result.model_glb_base64) {
    try {
      const glbBuffer = Buffer.from(result.model_glb_base64, 'base64');
      modelUrl = await uploadBuffer(glbBuffer, 'model/gltf-binary', 'models');
      console.log(`[vision] GLB uploaded for upload ${uploadId}: ${modelUrl}`);
    } catch (err) {
      console.error(`[vision] GLB upload failed (non-fatal):`, (err as Error).message);
    }
  }

  // ── 4. pgvector cosine similarity search ────────────────────────────────
  // Pre-filter by gym_id + colour before ANN (shrinks candidate set, keeps index fast).
  // <=> returns cosine distance [0, 2]; similarity = 1 - distance.
  const vectorLiteral = `[${result.hold_vector.join(',')}]`;
  const { rows: candidates } = await pool.query<{ id: string; score: number }>(
    `SELECT id, (1 - (hold_vector <=> $1::vector))::float AS score
     FROM problems
     WHERE gym_id = $2 AND colour = $3 AND status = 'active'
     ORDER BY hold_vector <=> $1::vector
     LIMIT 5`,
    [vectorLiteral, gymId, colour],
  );

  const topScore = candidates[0]?.score ?? 0;
  const topProblemId = candidates[0]?.id ?? null;

  // ── 5. Apply thresholds and update upload ────────────────────────────────
  if (topScore >= SIMILARITY_THRESHOLD_AUTO && topProblemId !== null) {
    // Auto-match: link to existing problem without user confirmation
    await pool.query(
      `UPDATE uploads
       SET processing_status = 'matched'::processing_status,
           similarity_score   = $2,
           problem_id         = $3
       WHERE id = $1`,
      [uploadId, topScore, topProblemId],
    );
    // Update model_url on matched problem if it doesn't have one yet
    if (modelUrl && topProblemId) {
      await pool
        .query(`UPDATE problems SET model_url = $1 WHERE id = $2 AND model_url IS NULL`, [
          modelUrl,
          topProblemId,
        ])
        .catch(() => {});
    }
    console.log(
      `[vision] auto-matched upload ${uploadId} → problem ${topProblemId} (score=${topScore.toFixed(3)})`,
    );
    if (userId) {
      pushService
        .sendToUser(userId, 'Climb identified!', 'Tap to log your ascent.', {
          uploadId,
          type: 'vision_complete',
        })
        .catch(() => {});
    }
  } else {
    // Confirm or new problem — mobile polls status and shows confirmation UI.
    // similarity_score < SIMILARITY_THRESHOLD_CONFIRM means no plausible match;
    // the confirm screen will pre-select "new problem".
    await pool.query(
      `UPDATE uploads
       SET processing_status = 'awaiting_confirmation'::processing_status,
           similarity_score   = $2
       WHERE id = $1`,
      [uploadId, topScore],
    );
    const label = topScore >= SIMILARITY_THRESHOLD_CONFIRM ? 'confirm-needed' : 'new-problem';
    console.log(`[vision] ${label} upload ${uploadId} (score=${topScore.toFixed(3)})`);
    if (userId) {
      pushService
        .sendToUser(userId, 'Review your climb', 'We found a possible match — tap to confirm.', {
          uploadId,
          type: 'vision_complete',
        })
        .catch(() => {});
    }
  }
}

// Only spin up the BullMQ worker when this file is the entry point (not when
// required by tests). Route/worker consumers still get `processVisionJob`.
/* istanbul ignore if -- only runs when this file is the process entry point */
if (require.main === module) {
  const worker = new Worker<VisionJobData>('vision', processVisionJob, {
    connection: redisConnection,
  });

  worker.on('failed', async (job, err) => {
    console.error(`[vision] job ${job?.id ?? '?'} failed:`, err.message);
    if (job?.data.uploadId) {
      const { rows } = await pool
        .query<{
          user_id: string;
        }>(
          `UPDATE uploads SET processing_status = 'failed'::processing_status WHERE id = $1 RETURNING user_id`,
          [job.data.uploadId],
        )
        .catch((dbErr: unknown) => {
          console.error('[vision] failed to mark upload as failed:', (dbErr as Error).message);
          return { rows: [] as { user_id: string }[] };
        });
      const userId = rows[0]?.user_id;
      if (userId) {
        pushService
          .sendToUser(userId, 'Upload failed', 'Photo processing failed. Please try again.', {
            uploadId: job.data.uploadId,
            type: 'vision_failed',
          })
          .catch(() => {});
      }
    }
  });

  console.log('[vision] worker started, listening on queue "vision"');
}
