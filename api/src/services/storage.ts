import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

function getSupabaseClient(): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new AppError(
      'STORAGE_NOT_CONFIGURED',
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for file uploads',
      500,
    );
  }
  return createClient(url, key);
}

// Module-level singleton — created once on first upload call
let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!_client) _client = getSupabaseClient();
  return _client;
}

/**
 * Upload a base64-encoded image to Supabase Storage and return the public URL.
 * Accepts both raw base64 and data-URL format (data:image/png;base64,...).
 * `folder` must match a Supabase bucket name ('avatars' or 'problems').
 */
export async function uploadBase64Image(base64: string, folder: string): Promise<string> {
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/s);
  const contentType = match?.[1] ?? 'image/jpeg';
  const raw = match?.[2] ?? base64;
  const ext = contentType.split('/')[1] ?? 'jpg';

  const buffer = Buffer.from(raw, 'base64');
  const key = `${crypto.randomUUID()}.${ext}`;

  const { error } = await client().storage.from(folder).upload(key, buffer, { contentType });
  if (error) throw new AppError('UPLOAD_FAILED', error.message, 500);

  return client().storage.from(folder).getPublicUrl(key).data.publicUrl;
}

/**
 * Upload a raw Buffer (e.g. from multer memoryStorage) to Supabase Storage and return the public URL.
 * `folder` must match a Supabase bucket name ('avatars' or 'problems').
 */
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  folder: string,
): Promise<string> {
  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `${crypto.randomUUID()}.${ext}`;

  const { error } = await client().storage.from(folder).upload(key, buffer, { contentType });
  if (error) throw new AppError('UPLOAD_FAILED', error.message, 500);

  return client().storage.from(folder).getPublicUrl(key).data.publicUrl;
}
