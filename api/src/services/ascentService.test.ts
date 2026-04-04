jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import { createAscent, getAscentById } from './ascentService';
import { AppError } from '../middleware/errorHandler';

beforeEach(resetMock);

describe('createAscent', () => {
  const userId = 'user-1';
  const problemId = 'problem-1';
  const input = {
    user_grade: 'V5',
    rating: 4,
    notes: 'Great problem',
    video_url: null,
    visibility: 'public' as const,
  };

  it('should resolve type as flash when no prior ascent exists', async () => {
    // resolveType query: no prior ascents
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // INSERT query
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ascent-1' }], rowCount: 1 });

    const id = await createAscent(userId, problemId, input);

    expect(id).toBe('ascent-1');
    // Check the INSERT was called with 'flash'
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toEqual([
      userId,
      problemId,
      'flash',
      'V5',
      4,
      'Great problem',
      null,
      'public',
    ]);
  });

  it('should resolve type as send when a prior ascent exists', async () => {
    // resolveType query: prior ascent exists
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    // INSERT query
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ascent-2' }], rowCount: 1 });

    const id = await createAscent(userId, problemId, input);

    expect(id).toBe('ascent-2');
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall![1]).toEqual([
      userId,
      problemId,
      'send',
      'V5',
      4,
      'Great problem',
      null,
      'public',
    ]);
  });

  it('should throw AppError when INSERT returns no rows', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    try {
      await createAscent(userId, problemId, input);
      fail('Expected AppError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'INTERNAL_ERROR', statusCode: 500 });
    }
  });
});

describe('getAscentById', () => {
  it('should return a properly shaped AscentWithDetails', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'a-1',
          type: 'flash',
          user_grade: 'V4',
          rating: 3,
          notes: null,
          visibility: 'public',
          logged_at: '2026-01-01T00:00:00Z',
          problem_id: 'p-1',
          colour: 'red',
          consensus_grade: 'V4',
          gym_id: 'g-1',
          gym_name: 'Beta Bloc',
        },
      ],
      rowCount: 1,
    });

    const result = await getAscentById('a-1');

    expect(result).toEqual({
      id: 'a-1',
      type: 'flash',
      user_grade: 'V4',
      rating: 3,
      notes: null,
      visibility: 'public',
      logged_at: '2026-01-01T00:00:00Z',
      problem: {
        id: 'p-1',
        colour: 'red',
        consensus_grade: 'V4',
        gym: { id: 'g-1', name: 'Beta Bloc' },
      },
    });
  });

  it('should throw NOT_FOUND when ascent does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    try {
      await getAscentById('non-existent');
      fail('Expected AppError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    }
  });
});
