jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import { findNearby, getGymById, listAll, getGymProblems } from './gymService';
import { AppError } from '../middleware/errorHandler';

beforeEach(resetMock);

describe('findNearby', () => {
  it('should pass lat, lng, radius, and limit as query params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await findNearby(45.5, -73.6, 10, 5);

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toEqual([45.5, -73.6, 10, 5]);
  });

  it('should return gyms with distance_km', async () => {
    const fakeGym = {
      id: 'gym-1',
      name: 'Allez Up',
      city: 'Montreal',
      lat: 45.48,
      lng: -73.58,
      default_retirement_days: 14,
      created_at: '2026-01-01',
      distance_km: 2.5,
    };
    mockQuery.mockResolvedValueOnce({ rows: [fakeGym], rowCount: 1 });

    const result = await findNearby(45.5, -73.6, 10, 5);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(fakeGym);
    expect(result[0]!.distance_km).toBe(2.5);
  });

  it('should return empty array when no gyms are nearby', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await findNearby(0, 0, 1, 5);

    expect(result).toEqual([]);
  });

  it('should return multiple gyms sorted by distance', async () => {
    const gyms = [
      {
        id: 'gym-1', name: 'Close Gym', city: 'A', lat: 45.5, lng: -73.6,
        default_retirement_days: 14, created_at: '2026-01-01', distance_km: 1.2,
      },
      {
        id: 'gym-2', name: 'Far Gym', city: 'B', lat: 45.6, lng: -73.7,
        default_retirement_days: 14, created_at: '2026-01-01', distance_km: 8.9,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: gyms, rowCount: 2 });

    const result = await findNearby(45.5, -73.6, 10, 5);

    expect(result).toHaveLength(2);
    expect(result[0]!.distance_km).toBeLessThan(result[1]!.distance_km);
  });
});

describe('getGymById', () => {
  it('should return gym detail with counts', async () => {
    const fakeGym = {
      id: 'gym-1',
      name: 'Allez Up',
      city: 'Montreal',
      lat: 45.48,
      lng: -73.58,
      default_retirement_days: 14,
      created_at: '2026-01-01',
      active_problem_count: 42,
      total_ascents_all_time: 1500,
    };
    mockQuery.mockResolvedValueOnce({ rows: [fakeGym], rowCount: 1 });

    const result = await getGymById('gym-1');

    expect(result.id).toBe('gym-1');
    expect(result.active_problem_count).toBe(42);
    expect(result.total_ascents_all_time).toBe(1500);
  });

  it('should throw NOT_FOUND when gym does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    try {
      await getGymById('missing');
      fail('Expected AppError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    }
  });
});

describe('listAll', () => {
  it('should return all gyms', async () => {
    const gyms = [
      {
        id: 'gym-1', name: 'Allez Up', city: 'Montreal',
        lat: 45.48, lng: -73.58, default_retirement_days: 14, created_at: '2026-01-01',
      },
      {
        id: 'gym-2', name: 'Beta Bloc', city: 'Montreal',
        lat: 45.52, lng: -73.62, default_retirement_days: 21, created_at: '2026-01-01',
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: gyms, rowCount: 2 });

    const result = await listAll();

    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Allez Up');
  });

  it('should return empty array when no gyms exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await listAll();

    expect(result).toEqual([]);
  });
});

describe('getGymProblems', () => {
  it('should return paginated problems with has_more flag', async () => {
    // Request limit=2, so service queries limit+1=3
    const problems = [
      {
        id: 'p-1', colour: 'red', consensus_grade: 'V3', total_sends: 5,
        first_upload_at: '2026-01-03', retired_at: null, total_attempts: 8,
        flash_count: 2, thumbnail_url: null,
      },
      {
        id: 'p-2', colour: 'blue', consensus_grade: 'V5', total_sends: 3,
        first_upload_at: '2026-01-02', retired_at: null, total_attempts: 6,
        flash_count: 1, thumbnail_url: null,
      },
      {
        id: 'p-3', colour: 'green', consensus_grade: 'V1', total_sends: 10,
        first_upload_at: '2026-01-01', retired_at: null, total_attempts: 15,
        flash_count: 5, thumbnail_url: null,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: problems, rowCount: 3 });

    const result = await getGymProblems('gym-1', 'active', undefined, 2);

    expect(result.data).toHaveLength(2);
    expect(result.has_more).toBe(true);
    expect(result.cursor).toBe('p-2');
  });

  it('should return has_more=false when results fit within limit', async () => {
    const problems = [
      {
        id: 'p-1', colour: 'red', consensus_grade: 'V3', total_sends: 5,
        first_upload_at: '2026-01-01', retired_at: null, total_attempts: 8,
        flash_count: 2, thumbnail_url: null,
      },
    ];
    mockQuery.mockResolvedValueOnce({ rows: problems, rowCount: 1 });

    const result = await getGymProblems('gym-1', 'active', undefined, 2);

    expect(result.data).toHaveLength(1);
    expect(result.has_more).toBe(false);
    expect(result.cursor).toBeNull();
  });

  it('should include cursor param when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getGymProblems('gym-1', 'active', 'cursor-id', 20);

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toEqual(['gym-1', 21, 'cursor-id']);
  });
});
