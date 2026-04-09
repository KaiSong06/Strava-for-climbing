jest.mock('../lib/supabase', () => {
  const mockUpload = jest.fn();
  const mockGetPublicUrl = jest.fn();
  return {
    supabaseAdmin: jest.fn(() => ({
      storage: {
        from: jest.fn(() => ({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        })),
      },
    })),
    __mockUpload: mockUpload,
    __mockGetPublicUrl: mockGetPublicUrl,
  };
});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

const { __mockUpload, __mockGetPublicUrl } = require('../lib/supabase');

import { uploadBase64Image, uploadBuffer } from './storage';
import { AppError } from '../middleware/errorHandler';

beforeEach(() => {
  __mockUpload.mockReset();
  __mockGetPublicUrl.mockReset();
  delete process.env['STORAGE_BACKEND'];
  delete process.env['S3_ENDPOINT'];
  delete process.env['S3_PUBLIC_URL'];
});

describe('uploadBase64Image', () => {
  it('should upload to Supabase by default and return public URL', async () => {
    __mockUpload.mockResolvedValue({ error: null });
    __mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://supabase.co/avatars/test-uuid-1234.jpeg' } });

    const result = await uploadBase64Image('aGVsbG8=', 'avatars');

    expect(result).toBe('https://supabase.co/avatars/test-uuid-1234.jpeg');
    expect(__mockUpload).toHaveBeenCalledTimes(1);
  });

  it('should parse data URL format and extract content type', async () => {
    __mockUpload.mockResolvedValue({ error: null });
    __mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://supabase.co/avatars/test-uuid-1234.png' } });

    await uploadBase64Image('data:image/png;base64,iVBOR', 'avatars');

    expect(__mockUpload).toHaveBeenCalledTimes(1);
  });

  it('should throw AppError when Supabase upload fails', async () => {
    __mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });

    await expect(uploadBase64Image('aGVsbG8=', 'avatars')).rejects.toThrow(AppError);
    await expect(uploadBase64Image('aGVsbG8=', 'avatars')).rejects.toMatchObject({
      code: 'UPLOAD_FAILED',
      statusCode: 500,
    });
  });

  it('should upload to S3 when STORAGE_BACKEND=s3', async () => {
    process.env['STORAGE_BACKEND'] = 's3';
    process.env['S3_PUBLIC_URL'] = 'https://s3.local';

    const result = await uploadBase64Image('aGVsbG8=', 'avatars');

    expect(result).toContain('https://s3.local/avatars/');
    expect(__mockUpload).not.toHaveBeenCalled();
  });
});

describe('uploadBuffer', () => {
  it('should upload buffer to Supabase and return public URL', async () => {
    __mockUpload.mockResolvedValue({ error: null });
    __mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://supabase.co/problems/test-uuid-1234.jpeg' } });

    const buf = Buffer.from('test');
    const result = await uploadBuffer(buf, 'image/jpeg', 'problems');

    expect(result).toBe('https://supabase.co/problems/test-uuid-1234.jpeg');
  });

  it('should throw AppError when Supabase upload fails', async () => {
    __mockUpload.mockResolvedValue({ error: { message: 'Upload error' } });

    await expect(uploadBuffer(Buffer.from('x'), 'image/jpeg', 'problems')).rejects.toThrow(AppError);
  });

  it('should upload to S3 when STORAGE_BACKEND=s3', async () => {
    process.env['STORAGE_BACKEND'] = 's3';
    process.env['S3_PUBLIC_URL'] = 'https://s3.local';

    const result = await uploadBuffer(Buffer.from('test'), 'image/png', 'problems');

    expect(result).toContain('https://s3.local/problems/');
    expect(__mockUpload).not.toHaveBeenCalled();
  });
});
