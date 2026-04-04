jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import { createUpload, getUploadById, updateUpload } from './uploadService';
import { AppError } from '../middleware/errorHandler';

beforeEach(resetMock);

describe('createUpload', () => {
  it('should create an upload with pending status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'upload-1' }], rowCount: 1 });

    const id = await createUpload('user-1', 'gym-1', 'red', ['https://img.jpg']);

    expect(id).toBe('upload-1');
    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain("'pending'");
    expect(call![1]).toEqual(['user-1', 'gym-1', 'red', ['https://img.jpg']]);
  });

  it('should throw AppError when INSERT returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(
      createUpload('user-1', 'gym-1', 'red', ['https://img.jpg']),
    ).rejects.toThrow(AppError);
  });
});

describe('getUploadById', () => {
  it('should return the upload row', async () => {
    const fakeUpload = {
      id: 'upload-1',
      user_id: 'user-1',
      problem_id: null,
      photo_urls: ['https://img.jpg'],
      processing_status: 'pending',
      similarity_score: null,
      hold_vector: null,
      gym_id: 'gym-1',
      colour: 'blue',
      created_at: '2026-01-01T00:00:00Z',
    };
    mockQuery.mockResolvedValueOnce({ rows: [fakeUpload], rowCount: 1 });

    const result = await getUploadById('upload-1');

    expect(result).toEqual(fakeUpload);
  });

  it('should throw NOT_FOUND when upload does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    try {
      await getUploadById('missing');
      fail('Expected AppError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    }
  });
});

describe('updateUpload', () => {
  it('should build SET clause for processing_status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUpload('upload-1', { processing_status: 'matched' });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain('processing_status');
    expect(call![1]).toEqual(['upload-1', 'matched']);
  });

  it('should build SET clause for multiple fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUpload('upload-1', {
      processing_status: 'matched',
      similarity_score: 0.95,
      problem_id: 'prob-1',
    });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain('processing_status');
    expect(call![0]).toContain('similarity_score');
    expect(call![0]).toContain('problem_id');
    expect(call![1]).toEqual(['upload-1', 'matched', 0.95, 'prob-1']);
  });

  it('should serialize hold_vector as JSON for JSONB storage', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUpload('upload-1', { hold_vector: [0.1, 0.2, 0.3] });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain('hold_vector');
    // hold_vector is serialized as JSON string
    expect(call![1]).toContain(JSON.stringify([0.1, 0.2, 0.3]));
  });

  it('should not execute query when input is empty', async () => {
    await updateUpload('upload-1', {});

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('should handle status transition to awaiting_confirmation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUpload('upload-1', {
      processing_status: 'awaiting_confirmation',
      similarity_score: 0.85,
      problem_id: 'prob-1',
    });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toContain('awaiting_confirmation');
    expect(call![1]).toContain(0.85);
  });

  it('should handle status transition to failed', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUpload('upload-1', { processing_status: 'failed' });

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toContain('failed');
  });
});
