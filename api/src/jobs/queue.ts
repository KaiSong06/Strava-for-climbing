import { Queue } from 'bullmq';

if (!process.env['REDIS_URL']) {
  throw new Error('REDIS_URL env var is required');
}

// Parse redis://[:password@]host[:port][/db] into BullMQ connection options
function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.pathname && parsed.pathname !== '/' ? { db: parseInt(parsed.pathname.slice(1), 10) } : {}),
  };
}

export const redisConnection = parseRedisUrl(process.env['REDIS_URL']);

/** Vision pipeline job payload */
export interface VisionJobData {
  uploadId: string;
  userId: string;
  gymId: string;
  colour: string;
  photoUrls: string[];
}

export const visionQueue = new Queue<VisionJobData>('vision', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
