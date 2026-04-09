/**
 * Integration tests for the primary REST routes, backed by real Postgres
 * (pgvector) and Redis running in testcontainers.
 *
 * Covers:
 *   - POST /uploads  (auth, validation, enqueue)
 *   - GET/POST /uploads/:id/status, /confirm
 *   - POST /ascents  (flash/send detection, consensus recalc, visibility)
 *   - POST/DELETE /users/:username/follow (incl. self-follow, duplicate)
 *   - GET /users/:username/followers|following with keyset pagination
 *   - GET /feed (personal + discover)
 *   - POST /uploads/:id/dispute  +  POST /disputes/:id/vote (incl. split resolution)
 *
 * All tests share a single Postgres + Redis container for speed. Each test
 * cleans up its own rows via targeted deletes where necessary.
 */
import request from 'supertest';
import type { Pool } from 'pg';
import { generateTestKeypair, signTestToken, installJwksMock } from '../test/fakeJwks';
import {
  bootTestEnv,
  type TestCtx,
} from '../test/setup';

// Install the JWKS mock and the BullMQ queue mock BEFORE modules import them.
installJwksMock();

// Mock visionQueue globally to avoid starting a real worker against test redis.
const visionQueueAddMock = jest.fn().mockResolvedValue({ id: 'job-1' });
jest.doMock('../jobs/queue', () => ({
  visionQueue: { add: visionQueueAddMock, close: jest.fn().mockResolvedValue(undefined) },
  redisConnection: {},
}));

// Mock storage so upload tests don't try to hit S3/Supabase.
jest.doMock('../services/storage', () => ({
  uploadBuffer: jest.fn(async () => 'https://cdn.test/fake.jpg'),
  uploadBase64Image: jest.fn(async () => 'https://cdn.test/fake.jpg'),
}));

// Mock Sentry (noop) to keep error capture quiet during tests.
// Must stub every symbol api/src/lib/sentry.ts touches at module load time —
// otherwise importing createApp() throws `Sentry.consoleLoggingIntegration is not a function`.
jest.doMock('@sentry/node', () => ({
  captureException: jest.fn(),
  setupExpressErrorHandler: jest.fn(),
  init: jest.fn(),
  consoleLoggingIntegration: jest.fn(() => ({ name: 'console' })),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fmt: jest.fn((strings: TemplateStringsArray) => strings.join('')),
  },
}));

// Mock pushService so we never attempt real Expo push calls.
jest.doMock('../services/pushService', () => ({
  sendToUser: jest.fn().mockResolvedValue(undefined),
  registerToken: jest.fn().mockResolvedValue(undefined),
  removeToken: jest.fn().mockResolvedValue(undefined),
}));

let ctx: TestCtx;
let pool: Pool;
let tokenA: string;
let tokenB: string;

beforeAll(async () => {
  await generateTestKeypair();
  ctx = await bootTestEnv();
  pool = ctx.pool;
  tokenA = await signTestToken({ sub: ctx.fixtures.userA.id });
  tokenB = await signTestToken({ sub: ctx.fixtures.userB.id });
}, 180_000);

afterAll(async () => {
  if (ctx) await ctx.teardown();
});

// ─── POST /uploads ─────────────────────────────────────────────────────────────

describe('POST /uploads', () => {
  afterEach(async () => {
    await pool.query(`DELETE FROM uploads WHERE user_id = $1`, [ctx.fixtures.userA.id]);
    visionQueueAddMock.mockClear();
  });

  it('returns 401 when no Bearer token is supplied', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .field('colour', 'red')
      .field('gym_id', ctx.fixtures.gymId)
      .attach('photos', Buffer.from('fake'), { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates an upload and enqueues a vision job when auth + payload are valid', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('colour', 'red')
      .field('gym_id', ctx.fixtures.gymId)
      .attach('photos', Buffer.from('fake-jpg-bytes'), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'pending' });
    expect(res.body.uploadId).toBeTruthy();
    expect(visionQueueAddMock).toHaveBeenCalledTimes(1);

    const { rows } = await pool.query(`SELECT id, user_id, colour FROM uploads WHERE id = $1`, [
      res.body.uploadId,
    ]);
    expect(rows[0].user_id).toBe(ctx.fixtures.userA.id);
    expect(rows[0].colour).toBe('red');
  });

  it('returns 400 when no photos are attached', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('colour', 'red')
      .field('gym_id', ctx.fixtures.gymId);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when gym_id is not a UUID', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('colour', 'red')
      .field('gym_id', 'not-a-uuid')
      .attach('photos', Buffer.from('fake'), { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when colour is empty', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('colour', '')
      .field('gym_id', ctx.fixtures.gymId)
      .attach('photos', Buffer.from('fake'), { filename: 'a.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('rejects non-image file types', async () => {
    const res = await request(ctx.app)
      .post('/uploads')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('colour', 'red')
      .field('gym_id', ctx.fixtures.gymId)
      .attach('photos', Buffer.from('pdf-bytes'), {
        filename: 'a.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });
});

// ─── GET /uploads/:id/status ──────────────────────────────────────────────────

describe('GET /uploads/:id/status', () => {
  let uploadId: string;

  beforeAll(async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status)
       VALUES ($1, $2, 'red', $3, 'pending'::processing_status)
       RETURNING id`,
      [ctx.fixtures.userA.id, ctx.fixtures.gymId, ['https://cdn.test/1.jpg']],
    );
    uploadId = rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM uploads WHERE id = $1`, [uploadId]);
  });

  it('returns the upload status for the owner', async () => {
    const res = await request(ctx.app)
      .get(`/uploads/${uploadId}/status`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('returns 403 when the caller does not own the upload', async () => {
    const res = await request(ctx.app)
      .get(`/uploads/${uploadId}/status`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without auth', async () => {
    const res = await request(ctx.app).get(`/uploads/${uploadId}/status`);
    expect(res.status).toBe(401);
  });

  it('resolves modelUrl when the upload is linked to a problem with a model', async () => {
    // Create a problem with a model_url and link an upload to it
    const zeros = Array<number>(200).fill(0);
    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at, model_url)
       VALUES ($1, 'orange', $2::vector, 'active', NOW(), $3) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`, 'https://cdn.test/model.glb'],
    );
    const pid = pRows[0]!.id;

    const { rows: uRows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status, problem_id)
       VALUES ($1, $2, 'orange', $3, 'matched'::processing_status, $4) RETURNING id`,
      [ctx.fixtures.userA.id, ctx.fixtures.gymId, ['https://cdn.test/1.jpg'], pid],
    );
    const uid = uRows[0]!.id;

    try {
      const res = await request(ctx.app)
        .get(`/uploads/${uid}/status`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.modelUrl).toBe('https://cdn.test/model.glb');
      expect(res.body.matchedProblemId).toBe(pid);
    } finally {
      await pool.query(`DELETE FROM uploads WHERE id = $1`, [uid]);
      await pool.query(`DELETE FROM problems WHERE id = $1`, [pid]);
    }
  });
});

// ─── POST /uploads/:id/confirm ────────────────────────────────────────────────

describe('POST /uploads/:id/confirm', () => {
  let uploadId: string;

  beforeEach(async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status, hold_vector)
       VALUES ($1, $2, 'red', $3, 'awaiting_confirmation'::processing_status, $4::jsonb)
       RETURNING id`,
      [
        ctx.fixtures.userA.id,
        ctx.fixtures.gymId,
        ['https://cdn.test/1.jpg'],
        JSON.stringify([0.1, 0.2, 0.3, 0.4]),
      ],
    );
    uploadId = rows[0]!.id;
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM ascents WHERE user_id = $1`, [ctx.fixtures.userA.id]);
    await pool.query(`DELETE FROM uploads WHERE id = $1`, [uploadId]);
  });

  it('creates a new problem and ascent when problemId=new', async () => {
    const res = await request(ctx.app)
      .post(`/uploads/${uploadId}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'new', user_grade: 'V3', rating: 4, visibility: 'public' });

    expect(res.status).toBe(201);
    expect(res.body.problemId).toBeTruthy();
    expect(res.body.ascentId).toBeTruthy();

    const { rows: ascents } = await pool.query(
      `SELECT type, user_grade, visibility FROM ascents WHERE id = $1`,
      [res.body.ascentId],
    );
    expect(ascents[0].type).toBe('flash');
    expect(ascents[0].user_grade).toBe('V3');
  });

  it('returns 403 when the caller does not own the upload', async () => {
    const res = await request(ctx.app)
      .post(`/uploads/${uploadId}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ problemId: 'new', user_grade: 'V3' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when the upload is not awaiting confirmation', async () => {
    // Mark as 'pending' so the guard fires
    await pool.query(
      `UPDATE uploads SET processing_status = 'pending'::processing_status WHERE id = $1`,
      [uploadId],
    );

    const res = await request(ctx.app)
      .post(`/uploads/${uploadId}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problemId: 'new', user_grade: 'V3' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('confirms to an existing problem by UUID', async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'red', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    const existingProblemId = rows[0]!.id;

    try {
      const res = await request(ctx.app)
        .post(`/uploads/${uploadId}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ problemId: existingProblemId, user_grade: 'V2' });

      expect(res.status).toBe(201);
      expect(res.body.problemId).toBe(existingProblemId);
    } finally {
      await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [existingProblemId]);
      await pool.query(`DELETE FROM problems WHERE id = $1`, [existingProblemId]);
    }
  });
});

// ─── POST /ascents (direct log + flash/send detection) ───────────────────────

describe('POST /ascents', () => {
  let problemId: string;

  beforeAll(async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'blue', $2::vector, 'active', NOW())
       RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    problemId = rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
    await pool.query(`DELETE FROM problems WHERE id = $1`, [problemId]);
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
  });

  it('creates an ascent with type=flash for the first climb on a problem', async () => {
    const res = await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: problemId, user_grade: 'V4', rating: 5, visibility: 'public' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(`SELECT type FROM ascents WHERE id = $1`, [res.body.ascentId]);
    expect(rows[0].type).toBe('flash');
  });

  it('records subsequent ascents as type=send', async () => {
    // First ascent → flash
    await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: problemId, user_grade: 'V4' });

    // Second ascent by same user → send
    const res = await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: problemId, user_grade: 'V4' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(`SELECT type FROM ascents WHERE id = $1`, [res.body.ascentId]);
    expect(rows[0].type).toBe('send');
  });

  it('recalculates consensus grade after each ascent', async () => {
    await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: problemId, user_grade: 'V3' });
    await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ problem_id: problemId, user_grade: 'V5' });

    const { rows } = await pool.query(`SELECT consensus_grade FROM problems WHERE id = $1`, [
      problemId,
    ]);
    // Median of [V3, V5] = second element (V5)
    expect(rows[0].consensus_grade).toBe('V5');
  });

  it('private visibility still creates the ascent row', async () => {
    const res = await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: problemId, user_grade: 'V3', visibility: 'private' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(`SELECT visibility FROM ascents WHERE id = $1`, [
      res.body.ascentId,
    ]);
    expect(rows[0].visibility).toBe('private');
  });

  it('returns 404 when problem_id does not exist', async () => {
    const res = await request(ctx.app)
      .post('/ascents')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem_id: '00000000-0000-0000-0000-000000000000', user_grade: 'V3' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(ctx.app)
      .post('/ascents')
      .send({ problem_id: problemId, user_grade: 'V3' });
    expect(res.status).toBe(401);
  });
});

// ─── Follows ──────────────────────────────────────────────────────────────────

describe('POST /users/:username/follow', () => {
  afterEach(async () => {
    await pool.query(`DELETE FROM follows`);
  });

  it('creates a follow relationship', async () => {
    const res = await request(ctx.app)
      .post(`/users/${ctx.fixtures.userB.username}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(201);
    const { rowCount } = await pool.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [ctx.fixtures.userA.id, ctx.fixtures.userB.id],
    );
    expect(rowCount).toBe(1);
  });

  it('returns 400 when a user tries to follow themselves', async () => {
    const res = await request(ctx.app)
      .post(`/users/${ctx.fixtures.userA.username}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 409 for a duplicate follow', async () => {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
      [ctx.fixtures.userA.id, ctx.fixtures.userB.id],
    );

    const res = await request(ctx.app)
      .post(`/users/${ctx.fixtures.userB.username}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('DELETE /users/:username/follow', () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [ctx.fixtures.userA.id, ctx.fixtures.userB.id],
    );
  });

  afterEach(async () => {
    await pool.query(`DELETE FROM follows`);
  });

  it('removes an existing follow', async () => {
    const res = await request(ctx.app)
      .delete(`/users/${ctx.fixtures.userB.username}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });

  it('returns 404 when not currently following', async () => {
    await pool.query(`DELETE FROM follows`);
    const res = await request(ctx.app)
      .delete(`/users/${ctx.fixtures.userB.username}/follow`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /users/:username/followers and /following', () => {
  beforeAll(async () => {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ctx.fixtures.userA.id, ctx.fixtures.userB.id],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM follows`);
  });

  it('lists followers with pagination metadata', async () => {
    const res = await request(ctx.app).get(`/users/${ctx.fixtures.userB.username}/followers`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.has_more).toBe(false);
  });

  it('lists following with pagination metadata', async () => {
    const res = await request(ctx.app).get(`/users/${ctx.fixtures.userA.username}/following`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].username).toBe(ctx.fixtures.userB.username);
  });

  it('paginates followers/following via cursor', async () => {
    // Create 3 extra users who all follow alice
    const extras: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (username, display_name, home_gym_id, phone)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`follower${i}`, `Follower${i}`, ctx.fixtures.gymId, `+1555200000${i}`],
      );
      extras.push(rows[0]!.id);
      await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [rows[0]!.id, ctx.fixtures.userA.id],
      );
    }

    try {
      const page1 = await request(ctx.app).get(
        `/users/${ctx.fixtures.userA.username}/followers?limit=2`,
      );
      expect(page1.status).toBe(200);
      expect(page1.body.data.length).toBe(2);
      expect(page1.body.has_more).toBe(true);

      const page2 = await request(ctx.app).get(
        `/users/${ctx.fixtures.userA.username}/followers?limit=2&cursor=${page1.body.cursor}`,
      );
      expect(page2.status).toBe(200);
      const page1Ids = new Set(page1.body.data.map((u: { id: string }) => u.id));
      for (const u of page2.body.data as { id: string }[]) {
        expect(page1Ids.has(u.id)).toBe(false);
      }
    } finally {
      for (const id of extras) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      }
    }
  });

  it('paginates following via cursor', async () => {
    // Create 3 extra users that alice follows
    const extras: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (username, display_name, home_gym_id, phone)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`followee${i}`, `Followee${i}`, ctx.fixtures.gymId, `+1555300000${i}`],
      );
      extras.push(rows[0]!.id);
      await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ctx.fixtures.userA.id, rows[0]!.id],
      );
    }

    try {
      const page1 = await request(ctx.app).get(
        `/users/${ctx.fixtures.userA.username}/following?limit=2`,
      );
      expect(page1.status).toBe(200);
      expect(page1.body.data.length).toBe(2);

      const page2 = await request(ctx.app).get(
        `/users/${ctx.fixtures.userA.username}/following?limit=2&cursor=${page1.body.cursor}`,
      );
      expect(page2.status).toBe(200);
      const page1Ids = new Set(page1.body.data.map((u: { id: string }) => u.id));
      for (const u of page2.body.data as { id: string }[]) {
        expect(page1Ids.has(u.id)).toBe(false);
      }
    } finally {
      for (const id of extras) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      }
    }
  });
});

// ─── Feed ─────────────────────────────────────────────────────────────────────

describe('GET /feed', () => {
  let problemId: string;

  beforeAll(async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'green', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    problemId = rows[0]!.id;

    // alice follows bob
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ctx.fixtures.userA.id, ctx.fixtures.userB.id],
    );

    // bob has a public ascent → appears in alice's feed
    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
       VALUES ($1, $2, 'flash', 'V2', 'public')`,
      [ctx.fixtures.userB.id, problemId],
    );

    // bob has a private ascent → must NOT appear in alice's feed
    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
       VALUES ($1, $2, 'send', 'V2', 'private')`,
      [ctx.fixtures.userB.id, problemId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
    await pool.query(`DELETE FROM follows`);
    await pool.query(`DELETE FROM problems WHERE id = $1`, [problemId]);
  });

  it('returns followed users public ascents only, not private ones', async () => {
    const res = await request(ctx.app)
      .get('/feed')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].user.username).toBe('bob');
  });

  it('returns 401 without auth', async () => {
    const res = await request(ctx.app).get('/feed');
    expect(res.status).toBe(401);
  });

  it('paginates via cursor without overlap', async () => {
    // Insert 3 extra public ascents by bob
    for (let i = 0; i < 3; i += 1) {
      await pool.query(
        `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility, logged_at)
         VALUES ($1, $2, 'send', 'V3', 'public', NOW() - ($3 || ' seconds')::interval)`,
        [ctx.fixtures.userB.id, problemId, `${i + 1}`],
      );
    }

    const page1 = await request(ctx.app)
      .get('/feed?limit=2')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.has_more).toBe(true);

    const page2 = await request(ctx.app)
      .get(`/feed?limit=2&cursor=${page1.body.cursor}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(page2.status).toBe(200);
    const page1Ids = new Set(page1.body.data.map((a: { id: string }) => a.id));
    for (const item of page2.body.data as { id: string }[]) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });
});

describe('GET /feed/discover', () => {
  let problemId: string;

  beforeAll(async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'black', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    problemId = rows[0]!.id;

    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
       VALUES ($1, $2, 'flash', 'V2', 'public')`,
      [ctx.fixtures.userB.id, problemId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
    await pool.query(`DELETE FROM problems WHERE id = $1`, [problemId]);
  });

  it('returns public ascents for unauthenticated callers', async () => {
    const res = await request(ctx.app).get('/feed/discover');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes the viewer own ascents when authenticated', async () => {
    const res = await request(ctx.app)
      .get('/feed/discover')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    for (const item of res.body.data as { user: { id: string } }[]) {
      expect(item.user.id).not.toBe(ctx.fixtures.userB.id);
    }
  });

  it('supports cursor pagination on /feed/discover', async () => {
    // Insert 3 public ascents by userB
    for (let i = 0; i < 3; i += 1) {
      await pool.query(
        `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility, logged_at)
         VALUES ($1, $2, 'send', 'V3', 'public', NOW() - ($3 || ' seconds')::interval)`,
        [ctx.fixtures.userB.id, problemId, `${i + 1}`],
      );
    }

    const page1 = await request(ctx.app).get('/feed/discover?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.has_more).toBe(true);

    const page2 = await request(ctx.app).get(`/feed/discover?limit=2&cursor=${page1.body.cursor}`);
    expect(page2.status).toBe(200);
    const page1Ids = new Set(page1.body.data.map((a: { id: string }) => a.id));
    for (const item of page2.body.data as { id: string }[]) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });
});

describe('GET /feed/gym/:gymId', () => {
  let problemId: string;

  beforeAll(async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'cyan', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    problemId = rows[0]!.id;

    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
       VALUES ($1, $2, 'flash', 'V2', 'public')`,
      [ctx.fixtures.userA.id, problemId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
    await pool.query(`DELETE FROM problems WHERE id = $1`, [problemId]);
  });

  it('returns gym-scoped public ascents', async () => {
    const res = await request(ctx.app).get(`/feed/gym/${ctx.fixtures.gymId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Disputes ─────────────────────────────────────────────────────────────────

describe('Disputes: POST /uploads/:id/dispute and POST /disputes/:id/vote', () => {
  let problemId: string;
  let uploadId: string;
  let disputeId: string;
  let extraVoters: { id: string; token: string }[];

  beforeAll(async () => {
    const zeros = Array<number>(200).fill(0);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'yellow', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    problemId = rows[0]!.id;

    const { rows: uploadRows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, problem_id, processing_status, hold_vector)
       VALUES ($1, $2, 'yellow', $3, $4, 'matched'::processing_status, $5::jsonb)
       RETURNING id`,
      [
        ctx.fixtures.userA.id,
        ctx.fixtures.gymId,
        ['https://cdn.test/1.jpg'],
        problemId,
        JSON.stringify([0.1, 0.2]),
      ],
    );
    uploadId = uploadRows[0]!.id;

    // Alice, Bob, and two extra voters must all have ascents on the problem
    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
       VALUES ($1, $2, 'flash', 'V3', 'public'), ($3, $2, 'flash', 'V4', 'public')`,
      [ctx.fixtures.userA.id, problemId, ctx.fixtures.userB.id],
    );

    // Create two additional voters
    const extras: { id: string; token: string }[] = [];
    for (let i = 0; i < 2; i += 1) {
      const { rows: u } = await pool.query<{ id: string }>(
        `INSERT INTO users (username, display_name, home_gym_id, phone)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`voter${i}`, `Voter ${i}`, ctx.fixtures.gymId, `+1555111100${i}`],
      );
      const voterId = u[0]!.id;
      await pool.query(
        `INSERT INTO ascents (user_id, problem_id, type, user_grade, visibility)
         VALUES ($1, $2, 'flash', 'V3', 'public')`,
        [voterId, problemId],
      );
      extras.push({ id: voterId, token: await signTestToken({ sub: voterId }) });
    }
    extraVoters = extras;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM match_disputes WHERE upload_id = $1`, [uploadId]);
    await pool.query(`DELETE FROM uploads WHERE id = $1`, [uploadId]);
    await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [problemId]);
    await pool.query(`DELETE FROM problems WHERE id = $1`, [problemId]);
    if (extraVoters) {
      for (const v of extraVoters) {
        await pool.query(`DELETE FROM users WHERE id = $1`, [v.id]);
      }
    }
  });

  it('creates a dispute on a matched upload', async () => {
    const res = await request(ctx.app)
      .post(`/uploads/${uploadId}/dispute`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(201);
    expect(res.body.disputeId).toBeTruthy();
    disputeId = res.body.disputeId;
  });

  it('rejects a second open dispute on the same upload', async () => {
    const res = await request(ctx.app)
      .post(`/uploads/${uploadId}/dispute`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(409);
  });

  it('rejects voters without an ascent on the disputed problem', async () => {
    // Create a new user with NO ascent
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (username, display_name, home_gym_id, phone)
       VALUES ('outsider', 'Outsider', $1, '+15551999999') RETURNING id`,
      [ctx.fixtures.gymId],
    );
    const outsiderId = rows[0]!.id;
    const outsiderToken = await signTestToken({ sub: outsiderId });

    try {
      const res = await request(ctx.app)
        .post(`/disputes/${disputeId}/vote`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ vote: 'confirm' });

      expect(res.status).toBe(403);
    } finally {
      await pool.query(`DELETE FROM users WHERE id = $1`, [outsiderId]);
    }
  });

  it('accepts split votes and resolves after 3 majority votes', async () => {
    // Alice and Bob vote split; third voter also votes split → resolves_split
    const r1 = await request(ctx.app)
      .post(`/disputes/${disputeId}/vote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ vote: 'split' });
    expect(r1.status).toBe(200);
    expect(r1.body.votes_split).toBe(1);
    expect(r1.body.status).toBe('open');

    const r2 = await request(ctx.app)
      .post(`/disputes/${disputeId}/vote`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ vote: 'split' });
    expect(r2.body.status).toBe('open'); // still only 2 votes

    const r3 = await request(ctx.app)
      .post(`/disputes/${disputeId}/vote`)
      .set('Authorization', `Bearer ${extraVoters[0]!.token}`)
      .send({ vote: 'split' });
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('resolved_split');
    expect(r3.body.votes_split).toBe(3);

    // Upload should now be reassigned to a new problem
    const { rows } = await pool.query<{ problem_id: string }>(
      `SELECT problem_id FROM uploads WHERE id = $1`,
      [uploadId],
    );
    expect(rows[0]!.problem_id).not.toBe(problemId);
  });

  it('rejects votes on already-resolved disputes', async () => {
    const res = await request(ctx.app)
      .post(`/disputes/${disputeId}/vote`)
      .set('Authorization', `Bearer ${extraVoters[1]!.token}`)
      .send({ vote: 'confirm' });

    expect(res.status).toBe(409);
  });

  it('returns 404 for a missing dispute', async () => {
    const res = await request(ctx.app)
      .post('/disputes/00000000-0000-0000-0000-000000000000/vote')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ vote: 'confirm' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when disputing an upload with no problem_id', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, processing_status)
       VALUES ($1, $2, 'yellow', $3, 'pending'::processing_status) RETURNING id`,
      [ctx.fixtures.userA.id, ctx.fixtures.gymId, ['https://cdn.test/1.jpg']],
    );
    const unlinkedUploadId = rows[0]!.id;

    try {
      const res = await request(ctx.app)
        .post(`/uploads/${unlinkedUploadId}/dispute`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    } finally {
      await pool.query(`DELETE FROM uploads WHERE id = $1`, [unlinkedUploadId]);
    }
  });

  it('returns 404 when disputing a non-existent upload', async () => {
    const res = await request(ctx.app)
      .post('/uploads/00000000-0000-0000-0000-000000000000/dispute')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('accepts confirm votes and resolves 3 majority confirms', async () => {
    // Separate scenario — new upload/dispute cycle
    const zeros = Array<number>(200).fill(0);
    const { rows: pRows } = await pool.query<{ id: string }>(
      `INSERT INTO problems (gym_id, colour, hold_vector, status, first_upload_at)
       VALUES ($1, 'pink', $2::vector, 'active', NOW()) RETURNING id`,
      [ctx.fixtures.gymId, `[${zeros.join(',')}]`],
    );
    const pid = pRows[0]!.id;

    const { rows: uRows } = await pool.query<{ id: string }>(
      `INSERT INTO uploads (user_id, gym_id, colour, photo_urls, problem_id, processing_status, hold_vector)
       VALUES ($1, $2, 'pink', $3, $4, 'matched'::processing_status, $5::jsonb) RETURNING id`,
      [
        ctx.fixtures.userA.id,
        ctx.fixtures.gymId,
        ['https://cdn.test/1.jpg'],
        pid,
        JSON.stringify([0.1]),
      ],
    );
    const uid = uRows[0]!.id;

    // Make 3 voters (alice, bob, + 1 new) all having ascents on this problem
    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, visibility)
       VALUES ($1, $2, 'flash', 'public'), ($3, $2, 'flash', 'public')`,
      [ctx.fixtures.userA.id, pid, ctx.fixtures.userB.id],
    );
    const { rows: vRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (username, display_name, home_gym_id, phone)
       VALUES ('voter3', 'Voter 3', $1, '+15551112003') RETURNING id`,
      [ctx.fixtures.gymId],
    );
    const voterId = vRows[0]!.id;
    const voterToken = await signTestToken({ sub: voterId });
    await pool.query(
      `INSERT INTO ascents (user_id, problem_id, type, visibility)
       VALUES ($1, $2, 'flash', 'public')`,
      [voterId, pid],
    );

    try {
      const created = await request(ctx.app)
        .post(`/uploads/${uid}/dispute`)
        .set('Authorization', `Bearer ${tokenA}`);
      const did = created.body.disputeId;

      await request(ctx.app)
        .post(`/disputes/${did}/vote`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ vote: 'confirm' });
      await request(ctx.app)
        .post(`/disputes/${did}/vote`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ vote: 'confirm' });
      const last = await request(ctx.app)
        .post(`/disputes/${did}/vote`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send({ vote: 'confirm' });

      expect(last.body.status).toBe('resolved_confirm');
    } finally {
      await pool.query(`DELETE FROM match_disputes WHERE upload_id = $1`, [uid]);
      await pool.query(`DELETE FROM uploads WHERE id = $1`, [uid]);
      await pool.query(`DELETE FROM ascents WHERE problem_id = $1`, [pid]);
      await pool.query(`DELETE FROM problems WHERE id = $1`, [pid]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [voterId]);
    }
  });
});
