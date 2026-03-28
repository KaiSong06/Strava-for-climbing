import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { supabaseAdmin } from '../lib/supabase';

// ── Supabase backend ─────────────────────────────────────────────────────────

const client = supabaseAdmin;

// ── S3 / MinIO backend (set STORAGE_BACKEND=s3 to use) ──────────────────────

let _s3: S3Client | null = null;
function s3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: process.env['S3_ENDPOINT'],
      region: process.env['S3_REGION'] ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? '',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? '',
      },
      forcePathStyle: true,
    });
  }
  return _s3;
}

async function uploadToS3(buffer: Buffer, contentType: string, folder: string): Promise<string> {
  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `${crypto.randomUUID()}.${ext}`;

  await s3Client().send(new PutObjectCommand({
    Bucket: folder,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  const base = process.env['S3_PUBLIC_URL'] ?? process.env['S3_ENDPOINT'] ?? '';
  return `${base}/${folder}/${key}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a base64-encoded image and return the public URL.
 * Accepts both raw base64 and data-URL format (data:image/png;base64,...).
 * `folder` must match a bucket name ('avatars' or 'problems').
 */
export async function uploadBase64Image(base64: string, folder: string): Promise<string> {
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/s);
  const contentType = match?.[1] ?? 'image/jpeg';
  const raw = match?.[2] ?? base64;
  const buffer = Buffer.from(raw, 'base64');

  if (process.env['STORAGE_BACKEND'] === 's3') {
    return uploadToS3(buffer, contentType, folder);
  }

  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `${crypto.randomUUID()}.${ext}`;
  const { error } = await client().storage.from(folder).upload(key, buffer, { contentType });
  if (error) throw new AppError('UPLOAD_FAILED', error.message, 500);
  return client().storage.from(folder).getPublicUrl(key).data.publicUrl;
}

/**
 * Upload a raw Buffer (e.g. from multer memoryStorage) and return the public URL.
 * `folder` must match a bucket name ('avatars' or 'problems').
 */
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  folder: string,
): Promise<string> {
  if (process.env['STORAGE_BACKEND'] === 's3') {
    return uploadToS3(buffer, contentType, folder);
  }

  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `${crypto.randomUUID()}.${ext}`;
  const { error } = await client().storage.from(folder).upload(key, buffer, { contentType });
  if (error) throw new AppError('UPLOAD_FAILED', error.message, 500);
  return client().storage.from(folder).getPublicUrl(key).data.publicUrl;
}
