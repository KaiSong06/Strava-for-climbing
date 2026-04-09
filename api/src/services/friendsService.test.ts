jest.mock('../db/pool', () => require('../test/dbMock').poolModule);

import { mockQuery, resetMock } from '../test/dbMock';
import { getFollowingWithActivity } from './friendsService';

beforeEach(resetMock);

describe('getFollowingWithActivity', () => {
  it('should return friends with activity status', async () => {
    const friends = [
      { id: 'u-1', username: 'alice', display_name: 'Alice', avatar_url: null, has_new_activity: true },
      { id: 'u-2', username: 'bob', display_name: 'Bob', avatar_url: 'https://img.co/bob.jpg', has_new_activity: false },
    ];
    mockQuery.mockResolvedValueOnce({ rows: friends, rowCount: 2 });

    const result = await getFollowingWithActivity('user-1');

    expect(result).toHaveLength(2);
    expect(result[0]!.has_new_activity).toBe(true);
    expect(result[1]!.has_new_activity).toBe(false);
  });

  it('should pass userId and default limit to query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getFollowingWithActivity('user-1');

    const call = mockQuery.mock.calls[0];
    expect(call![1]).toEqual(['user-1', 20]);
  });

  it('should use custom limit when provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getFollowingWithActivity('user-1', 5);

    const call = mockQuery.mock.calls[0];
    expect(call![1]).toEqual(['user-1', 5]);
  });

  it('should return empty array when user follows no one', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await getFollowingWithActivity('user-1');

    expect(result).toEqual([]);
  });
});
