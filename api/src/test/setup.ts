/**
 * Shared testcontainers-based harness for integration tests.
 *
 * Exports:
 *  - startTestContainers() — boots pgvector + redis containers, returns connection URLs
 *  - runMigrations(pool)    — applies db/migrations/*.sql in order
 *  - seedTestDb(pool)       — inserts fixture gym + users, returns their IDs
 *  - createTestApp()        — builds a fresh Express app (must be called AFTER env is set)
 *  - stopContainers()       — stops all running containers
 *
 * Usage pattern:
 *   let ctx: TestCtx;
 *   beforeAll(async () => { ctx = await bootTestEnv(); }, 120_000);
 *   afterAll(async () => { await ctx.teardown(); });
 */
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface StartedContainers {
  pgUrl: string;
  redisUrl: string;
  pgContainer: StartedTestContainer;
  redisContainer: StartedTestContainer;
  stop: () => Promise<void>;
}

export interface TestFixtures {
  gymId: string;
  userA: { id: string; username: string };
  userB: { id: string; username: string };
}

export interface TestCtx {
  pgUrl: string;
  redisUrl: string;
  pool: Pool;
  app: Express;
  fixtures: TestFixtures;
  teardown: () => Promise<void>;
}

export async function startTestContainers(): Promise<StartedContainers> {
  const pgContainer = await new GenericContainer('pgvector/pgvector:pg16')
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres',
      POSTGRES_DB: 'crux_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withStartupTimeout(120_000)
    .start();

  const redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .withStartupTimeout(60_000)
    .start();

  const pgUrl = `postgres://postgres:postgres@${pgContainer.getHost()}:${pgContainer.getMappedPort(
    5432,
  )}/crux_test`;
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  return {
    pgUrl,
    redisUrl,
    pgContainer,
    redisContainer,
    stop: async () => {
      await redisContainer.stop().catch(() => {});
      await pgContainer.stop().catch(() => {});
    },
  };
}

/** Apply every SQL file in db/migrations in numeric order. */
export async function runMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // Migration 008 drops password_hash (which 001 marks NOT NULL with no default).
    // For fresh test containers we insert users AFTER all migrations, so there's no data conflict.
    await pool.query(sql);
  }
}

/** Insert a minimum fixture set: 1 gym, 2 users. Returns their generated UUIDs. */
export async function seedTestDb(pool: Pool): Promise<TestFixtures> {
  const {
    rows: [gym],
  } = await pool.query<{ id: string }>(
    `INSERT INTO gyms (name, city, lat, lng) VALUES ($1, $2, $3, $4) RETURNING id`,
    ['Test Gym', 'Testville', 43.6532, -79.3832],
  );

  const {
    rows: [a],
  } = await pool.query<{ id: string }>(
    `INSERT INTO users (username, display_name, home_gym_id, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
    ['alice', 'Alice', gym!.id, '+15551000001'],
  );

  const {
    rows: [b],
  } = await pool.query<{ id: string }>(
    `INSERT INTO users (username, display_name, home_gym_id, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
    ['bob', 'Bob', gym!.id, '+15551000002'],
  );

  return {
    gymId: gym!.id,
    userA: { id: a!.id, username: 'alice' },
    userB: { id: b!.id, username: 'bob' },
  };
}

/**
 * Build a fresh Express app. MUST be called after the env has been set and
 * after jest.resetModules() so that the pg Pool and BullMQ queue read the
 * freshly-set DATABASE_URL / REDIS_URL.
 */
export function createTestApp(options: { disableRateLimit?: boolean } = {}): Express {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createApp } = require('../index') as typeof import('../index');
  return createApp({ disableRateLimit: true, ...options });
}

/**
 * One-stop boot: starts containers, sets env, resets modules, runs migrations,
 * seeds minimal fixtures, and returns a ready-to-use app + pool + teardown.
 */
export async function bootTestEnv(
  options: { mockBullMq?: boolean } = {},
): Promise<TestCtx> {
  const containers = await startTestContainers();

  process.env['DATABASE_URL'] = containers.pgUrl;
  process.env['REDIS_URL'] = containers.redisUrl;
  process.env['DB_SSL'] = 'false';
  process.env['SUPABASE_URL'] = process.env['SUPABASE_URL'] ?? 'https://test.supabase.co';
  process.env['SUPABASE_SERVICE_ROLE_KEY'] =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? 'test-service-role';
  process.env['INTERNAL_SECRET'] = process.env['INTERNAL_SECRET'] ?? 'test-internal-secret';
  process.env['VISION_SERVICE_URL'] = process.env['VISION_SERVICE_URL'] ?? 'http://localhost:9999';

  // Reset modules so db/pool.ts and jobs/queue.ts re-read the updated env.
  jest.resetModules();

  if (options.mockBullMq) {
    jest.doMock('../jobs/queue', () => ({
      visionQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
      redisConnection: {},
    }));
  }

  // Build a fresh pool from the same env as the app will use.
  const pool = new Pool({
    connectionString: containers.pgUrl,
    ssl: false,
    max: 5,
  });

  await runMigrations(pool);
  const fixtures = await seedTestDb(pool);

  const app = createTestApp({ disableRateLimit: true });

  return {
    pgUrl: containers.pgUrl,
    redisUrl: containers.redisUrl,
    pool,
    app,
    fixtures,
    teardown: async () => {
      await pool.end().catch(() => {});
      // Also close the pool that the app created (lazy - same connection string).
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { pool: appPool } = require('../db/pool') as typeof import('../db/pool');
        await appPool.end().catch(() => {});
      } catch {
        // ignore
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { visionQueue } = require('../jobs/queue') as typeof import('../jobs/queue');
        await visionQueue.close().catch(() => {});
      } catch {
        // ignore
      }
      await containers.stop();
    },
  };
}
