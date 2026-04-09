/**
 * Unit + integration tests for the vision worker's processor.
 *
 * Uses a real Postgres (pgvector) container so the cosine-similarity ANN
 * queries run against actual data. The vision HTTP service is stubbed with
 * a local HTTP server that returns each of the three similarity buckets.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import type { Pool } from 'pg';
import type { Job } from 'bullmq';
import {
  startTestContainers,
  runMigrations,
  seedTestDb,
  type StartedContainers,
  type TestFixtures,
} from '../test/setup';

// Mock BullMQ so importing visionWorker doesn't try to spin up a real worker.
jest.mock('bullmq', () => {
  class FakeWorker {
    on(): this {
      return this;
    }
  }
  class FakeQueue {
    add = jest.fn().mockResolvedValue({ id: 'job-1' });
    close = jest.fn().mockResolvedValue(undefined);
  }
  return { Worker: FakeWorker, Queue: FakeQueue };
});

// Mock pushService so we never attempt real Expo push calls.
jest.mock('../services/pushService', () => ({
  sendToUser: jest.fn().mockResolvedValue(undefined),
  registerToken: jest.fn().mockResolvedValue(undefined),
  removeToken: jest.fn().mockResolvedValue(undefined),
}));

// Mock storage (GLB upload path).
jest.mock('../services/storage', () => ({
  uploadBuffer: jest.fn(async () => 'https://cdn.test/model.glb'),
  uploadBase64Image: jest.fn(async () => 'https://cdn.test/fake.jpg'),
}));

interface VisionStub {
  url: string;
  setResponse: (status: number, body: unknown) => void;
  setDelay: (ms: number) => void;
  close: () => Promise<void>;
}

async function createVisionStub(): Promise<VisionStub> {
  let status = 200;
  let body: unknown = {};
  let delay = 0;

  const server = http.createServer((req, res) => {
    let chunks = '';
    req.on('data', (c) => {
      chunks += c;
    });
    req.on('end', () => {
      const send = (): void => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
      };
      if (delay > 0) setTimeout(send, delay);
      else send();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    setResponse: (s, b) => {
      status = s;
      body = b;
    },
    setDelay: (ms) => {
      delay = ms;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

let containers: StartedContainers;
let pool: Pool;
let fixtures: TestFixtures;
let visionStub: VisionStub;
let processVisionJob: typeof import('./visionWorker').processVisionJob;

beforeAll(async () => {
  visionStub = await createVisionStub();

  containers = await startTestContainers();
  process.env['DATABASE_URL'] = containers.pgUrl;
  process.env['REDIS_URL'] = containers.redisUrl;
  process.env['DB_SSL'] = 'false';
  process.env['VISION_SERVICE_URL'] = visionStub.url;
  process.env['SIMILARITY_THRESHOLD_AUTO'] = '0.92';
  process.env['SIMILARITY_THRESHOLD_CONFIRM'] = '0.75';

  jest.resetModules();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pool: appPool } = require('../db/pool') as typeof import('../db/pool');
  pool = appPool;

  await runMigrations(pool);
  fixtures = await seedTestDb(pool);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ({ processVisionJob } = require('./visionWorker') as typeof import('./visionWorker'));
}, 180_000);

afterAll(async () => {
  await pool.end().catch(() => {});
  await containers.stop().catch(() => {});
  await visionStub.close().catch(() => {});
});

async function insertUpload(colour: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status)
     VALUES ($1, $2, $3, $4, 'pending'::processing_status) RETURNING id`,
    [fixtures.userA.id, fixtures.gymId, colour, ['https://cdn.test/photo.jpg']],
  );
  return rows[0]!.id;
}

function makeJob(uploadId: string, colour: string): Job<import('./queue').VisionJobData> {
  return {
    data: {
      uploadId,
      userId: fixtures.userA.id,
      gymId: fixtures.gymId,
      colour,
      photoUrls: ['https://cdn.test/photo.jpg'],
    },
  } as unknown as Job<import('./queue').VisionJobData>;
}

describe('processVisionJob', () => {
  afterEach(async () => {
    await pool.query(`DELETE FROM uploads WHERE user_id = $1`, [fixtures.userA.id]);
    await pool.query(`DELETE FROM problems WHERE gym_id = $1`, [fixtures.gymId]);
  });

  it('auto-matches when similarity >= 0.92', async () => {
    // Insert a problem whose hold_vector is a known unit vector.
    const holdVector = Array<number>(200).fill(0);
    holdVector[0] = 1;
    const vectorLiteral = `[${holdVector.join(',')}]`;

    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'red', $2::vector, 'active', NOW()) RETURNING id`,
      [fixtures.gymId, vectorLiteral],
    );
    const problemId = pRows[0]!.id;

    // Vision service returns the SAME vector so cosine similarity = 1
    visionStub.setResponse(200, {
      hold_vector: holdVector,
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: null,
    });

    const uploadId = await insertUpload('red');
    await processVisionJob(makeJob(uploadId, 'red'));

    const { rows } = await pool.query(
      `SELECT processing_status, similarity_score, problem_id FROM uploads WHERE id = $1`,
      [uploadId],
    );
    expect(rows[0].processing_status).toBe('matched');
    expect(rows[0].problem_id).toBe(problemId);
    expect(Number(rows[0].similarity_score)).toBeGreaterThanOrEqual(0.92);
  });

  it('transitions to awaiting_confirmation when 0.75 <= score < 0.92', async () => {
    // Insert a problem with a vector close-but-not-identical to what the stub returns
    const problemVec = Array<number>(200).fill(0);
    problemVec[0] = 1;
    problemVec[1] = 0;
    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'blue', $2::vector, 'active', NOW()) RETURNING id`,
      [fixtures.gymId, `[${problemVec.join(',')}]`],
    );
    const problemId = pRows[0]!.id;
    void problemId;

    // Stub vector: 45° off from problemVec → cosine similarity ≈ 0.707 — TOO LOW.
    // We want ≈0.8, so use a small angle offset.
    const stubVec = Array<number>(200).fill(0);
    stubVec[0] = Math.cos(Math.PI / 5); // ≈ 0.809
    stubVec[1] = Math.sin(Math.PI / 5); // ≈ 0.588

    visionStub.setResponse(200, {
      hold_vector: stubVec,
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: null,
    });

    const uploadId = await insertUpload('blue');
    await processVisionJob(makeJob(uploadId, 'blue'));

    const { rows } = await pool.query(
      `SELECT processing_status, similarity_score FROM uploads WHERE id = $1`,
      [uploadId],
    );
    expect(rows[0].processing_status).toBe('awaiting_confirmation');
    const score = Number(rows[0].similarity_score);
    expect(score).toBeGreaterThanOrEqual(0.75);
    expect(score).toBeLessThan(0.92);
  });

  it('transitions to awaiting_confirmation with score=0 when no candidates exist (new problem path)', async () => {
    // No existing problems in 'green' colour → candidates empty → topScore = 0
    visionStub.setResponse(200, {
      hold_vector: [1, 0, 0, 0],
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: null,
    });

    const uploadId = await insertUpload('green');
    await processVisionJob(makeJob(uploadId, 'green'));

    const { rows } = await pool.query(
      `SELECT processing_status, similarity_score FROM uploads WHERE id = $1`,
      [uploadId],
    );
    expect(rows[0].processing_status).toBe('awaiting_confirmation');
    expect(Number(rows[0].similarity_score)).toBe(0);
  });

  it('throws when the vision service returns a non-2xx status', async () => {
    visionStub.setResponse(500, { error: 'boom' });

    const uploadId = await insertUpload('red');
    await expect(processVisionJob(makeJob(uploadId, 'red'))).rejects.toThrow(/Vision service responded 500/);
  });

  it('handles the case where the upload row no longer exists (userId undefined)', async () => {
    // Job references a non-existent upload id. The UPDATE ... RETURNING path
    // returns zero rows, leaving `userId` undefined. The processor should
    // continue without crashing and still hit the new-problem path.
    const fakeUploadId = '00000000-0000-0000-0000-000000000abc';
    visionStub.setResponse(200, {
      hold_vector: [1, 0, 0, 0],
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: null,
    });

    // The processor should not throw even though no upload row exists —
    // subsequent UPDATEs on a missing id are no-ops.
    await processVisionJob(makeJob(fakeUploadId, 'magenta'));
  });

  it('swallows GLB upload failures and still completes matching', async () => {
    const holdVector = Array<number>(200).fill(0);
    holdVector[0] = 1;

    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'grey', $2::vector, 'active', NOW()) RETURNING id`,
      [fixtures.gymId, `[${holdVector.join(',')}]`],
    );
    const problemId = pRows[0]!.id;
    void problemId;

    // Force uploadBuffer to throw for this test only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storage = require('../services/storage') as { uploadBuffer: jest.Mock };
    storage.uploadBuffer.mockRejectedValueOnce(new Error('s3 down'));

    visionStub.setResponse(200, {
      hold_vector: holdVector,
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: Buffer.from('bad-glb').toString('base64'),
    });

    const uploadId = await insertUpload('grey');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await processVisionJob(makeJob(uploadId, 'grey'));
    errSpy.mockRestore();

    const { rows } = await pool.query(`SELECT processing_status FROM uploads WHERE id = $1`, [
      uploadId,
    ]);
    expect(rows[0].processing_status).toBe('matched');
  });

  it('uploads the GLB model and sets model_url on matched problem', async () => {
    const holdVector = Array<number>(200).fill(0);
    holdVector[0] = 1;

    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'purple', $2::vector, 'active', NOW()) RETURNING id`,
      [fixtures.gymId, `[${holdVector.join(',')}]`],
    );
    const problemId = pRows[0]!.id;

    const fakeGlbBase64 = Buffer.from('GLTF-BINARY-FAKE').toString('base64');
    visionStub.setResponse(200, {
      hold_vector: holdVector,
      hold_count: 1,
      wall_bbox: { x: 0, y: 0, w: 100, h: 100 },
      debug_image_url: null,
      model_glb_base64: fakeGlbBase64,
    });

    const uploadId = await insertUpload('purple');
    await processVisionJob(makeJob(uploadId, 'purple'));

    const { rows } = await pool.query(`SELECT model_url FROM problems WHERE id = $1`, [problemId]);
    expect(rows[0].model_url).toBe('https://cdn.test/model.glb');
  });
});
