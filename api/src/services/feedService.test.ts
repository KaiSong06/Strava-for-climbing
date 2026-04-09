jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import { getPersonalFeed, getGymFeed, getDiscoverFeed, getUserAscents } from './feedService';
import { encodeCursor, decodeCursor } from '../lib/cursorPagination';

beforeEach(resetMock);

function makeFeedRow(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    logged_at: '2026-01-01T00:00:00Z',
    type: 'flash',
    user_grade: 'V4',
    rating: 3,
    notes: null,
    photo_urls: null,
    user_id: 'u-1',
    username: 'climber',
    display_name: 'Climber One',
    avatar_url: null,
    problem_id: 'p-1',
    colour: 'red',
    consensus_grade: 'V4',
    gym_id: 'g-1',
    gym_name: 'Allez Up',
    ...overrides,
  };
}

describe('getPersonalFeed', () => {
  it('should return feed items with correct structure', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1')],
      rowCount: 1,
    });

    const result = await getPersonalFeed('viewer-1');

    expect(result.data).toHaveLength(1);
    expect(result.has_more).toBe(false);
    expect(result.cursor).toBeNull();
    expect(result.data[0]).toEqual({
      id: 'a-1',
      logged_at: '2026-01-01T00:00:00Z',
      type: 'flash',
      user_grade: 'V4',
      rating: 3,
      notes: null,
      photo_urls: [],
      user: {
        id: 'u-1',
        username: 'climber',
        display_name: 'Climber One',
        avatar_url: null,
      },
      problem: {
        id: 'p-1',
        colour: 'red',
        consensus_grade: 'V4',
        gym: { id: 'g-1', name: 'Allez Up' },
      },
    });
  });

  it('should set has_more=true and cursor when more rows exist', async () => {
    // Default limit=20, so service fetches 21. Simulate 21 rows returned.
    const rows = Array.from({ length: 21 }, (_, i) => makeFeedRow(`a-${i}`));
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 21 });

    const result = await getPersonalFeed('viewer-1');

    expect(result.data).toHaveLength(20);
    expect(result.has_more).toBe(true);
    // Cursor is an opaque base64url token; decode it to verify.
    const decoded = decodeCursor(result.cursor);
    expect(decoded).toEqual({ id: 'a-19', sortKey: '2026-01-01T00:00:00Z' });
  });

  it('should pass decoded cursor components as keyset params when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const cursor = encodeCursor({ id: 'cursor-id', sortKey: '2026-02-10T00:00:00.000Z' });
    await getPersonalFeed('viewer-1', cursor);

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    // Params: [viewerId, limit+1, sortKey, id]
    expect(call![1]).toEqual(['viewer-1', 21, '2026-02-10T00:00:00.000Z', 'cursor-id']);
    // And the generated SQL should reference $3/$4 for the keyset clause.
    expect(call![0]).toContain('a.logged_at < $3');
    expect(call![0]).toContain('a.id < $4');
  });

  it('should use default limit of 20 (fetch 21)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getPersonalFeed('viewer-1');

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toEqual(['viewer-1', 21]);
  });

  it('should convert null photo_urls to empty array', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1', { photo_urls: null })],
      rowCount: 1,
    });

    const result = await getPersonalFeed('viewer-1');
    expect(result.data[0]!.photo_urls).toEqual([]);
  });

  it('should preserve non-null photo_urls', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1', { photo_urls: ['https://img.jpg'] })],
      rowCount: 1,
    });

    const result = await getPersonalFeed('viewer-1');
    expect(result.data[0]!.photo_urls).toEqual(['https://img.jpg']);
  });
});

describe('getGymFeed', () => {
  it('should pass gym ID as first param', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getGymFeed('gym-1');

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]![0]).toBe('gym-1');
  });

  it('should return paginated results', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeFeedRow(`a-${i}`));
    mockQuery.mockResolvedValueOnce({ rows, rowCount: 5 });

    const result = await getGymFeed('gym-1', undefined, 10);

    expect(result.data).toHaveLength(5);
    expect(result.has_more).toBe(false);
  });
});

describe('getDiscoverFeed', () => {
  it('should work without a viewerId', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await getDiscoverFeed(undefined);

    expect(result.data).toEqual([]);
    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    // Only limit+1 param when no viewerId
    expect(call![1]).toEqual([21]);
  });

  it('should exclude viewer from results when viewerId is provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getDiscoverFeed('viewer-1');

    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toEqual([21, 'viewer-1']);
    expect(call![0]).toContain('a.user_id !=');
  });
});

describe('getUserAscents', () => {
  it('should show public ascents for anonymous viewer', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1')],
      rowCount: 1,
    });

    const result = await getUserAscents('target-user', undefined);

    expect(result.data).toHaveLength(1);
    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain("visibility = 'public'");
  });

  it('should show public+friends ascents when viewer is the target user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1')],
      rowCount: 1,
    });

    const result = await getUserAscents('user-1', 'user-1');

    expect(result.data).toHaveLength(1);
    const call = mockQuery.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![0]).toContain("IN ('public', 'friends')");
  });

  it('should check mutual follow for friends visibility', async () => {
    // First query: check mutual follow
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 });
    // Second query: get ascents
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1')],
      rowCount: 1,
    });

    const result = await getUserAscents('target-user', 'viewer-1');

    expect(result.data).toHaveLength(1);
    // The ascent query should include friends visibility
    const ascentCall = mockQuery.mock.calls[1];
    expect(ascentCall).toBeDefined();
    expect(ascentCall![0]).toContain("IN ('public', 'friends')");
  });

  it('should show only public when no mutual follow', async () => {
    // First query: check mutual follow - no result
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Second query: get ascents
    mockQuery.mockResolvedValueOnce({
      rows: [makeFeedRow('a-1')],
      rowCount: 1,
    });

    const result = await getUserAscents('target-user', 'viewer-1');

    expect(result.data).toHaveLength(1);
    const ascentCall = mockQuery.mock.calls[1];
    expect(ascentCall).toBeDefined();
    expect(ascentCall![0]).toContain("visibility = 'public'");
  });
});
