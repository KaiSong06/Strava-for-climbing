import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';

function getS3Bucket(): string {
  const bucket = process.env['AWS_S3_BUCKET'];
  if (!bucket) throw new AppError('S3_NOT_CONFIGURED', 'AWS_S3_BUCKET is required for file uploads', 500);
  return bucket;
}

function createS3Client(): S3Client {
  const region = process.env['AWS_REGION'];
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new AppError(
      'S3_NOT_CONFIGURED',
      'AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required for file uploads',
      500,
    );
  }

  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
}

/**
 * Upload a base64-encoded image to S3 and return the public URL.
 * Accepts both raw base64 and data-URL format (data:image/png;base64,...).
 */
export async function uploadBase64Image(base64: string, folder: string): Promise<string> {
  const bucket = getS3Bucket();

  // Strip data-URL prefix if present
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/s);
  const contentType = match?.[1] ?? 'image/jpeg';
  const raw = match?.[2] ?? base64;
  const ext = contentType.split('/')[1] ?? 'jpg';

  const buffer = Buffer.from(raw, 'base64');
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  const client = createS3Client();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
  );

  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

/**
 * Upload a raw Buffer (e.g. from multer memoryStorage) to S3 and return the public URL.
 */
export async function uploadBuffer(
  buffer: Buffer,
  contentType: string,
  folder: string,
): Promise<string> {
  const bucket = getS3Bucket();
  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  const client = createS3Client();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
  );

  return `https://${bucket}.s3.amazonaws.com/${key}`;
}
