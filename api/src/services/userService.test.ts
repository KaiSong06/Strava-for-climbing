jest.mock('../db/pool', () => require('../test/dbMock').poolModule);
jest.mock('./storage', () => ({
  uploadBase64Image: jest.fn().mockResolvedValue('https://cdn.example.com/avatar.jpg'),
}));

import { mockQuery, resetMock } from '../test/dbMock';
import { getMe, getByUsername, updateMe } from './userService';
import { AppError } from '../middleware/errorHandler';
import { uploadBase64Image } from './storage';

beforeEach(() => {
  resetMock();
  (uploadBase64Image as jest.Mock).mockClear();
});

const fakeUser = {
  id: 'u-1',
  username: 'climber1',
  display_name: 'Climber One',
  avatar_url: null,
  home_gym_id: 'g-1',
  username_changed_at: null,
  default_visibility: 'public' as const,
  phone: '+15551234567',
  home_gym_name: 'Beta Bloc',
  follower_count: 10,
  following_count: 5,
  created_at: '2026-01-01T00:00:00Z',
};

describe('getMe', () => {
  it('should return the authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [fakeUser], rowCount: 1 });

    const result = await getMe('u-1');

    expect(result).toEqual(fakeUser);
    expect(mockQuery.mock.calls[0]![1]).toEqual(['u-1']);
  });

  it('should throw NOT_FOUND when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    try {
      await getMe('missing');
      fail('Expected AppError');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    }
  });
});

describe('getByUsername', () => {
  it('should return user profile by username', async () => {
    const profile = { ...fakeUser };
    mockQuery.mockResolvedValueOnce({ rows: [profile], rowCount: 1 });

    const result = await getByUsername('climber1');

    expect(result.username).toBe('climber1');
    expect(mockQuery.mock.calls[0]![1]).toEqual(['climber1']);
  });

  it('should throw NOT_FOUND when username does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(getByUsername('nobody')).rejects.toThrow(AppError);
  });
});

describe('updateMe', () => {
  it('should update display_name', async () => {
    // UPDATE query
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getMe re-fetch
    mockQuery.mockResolvedValueOnce({ rows: [{ ...fakeUser, display_name: 'New Name' }], rowCount: 1 });

    const result = await updateMe('u-1', { display_name: 'New Name' });

    expect(result.display_name).toBe('New Name');
    const updateCall = mockQuery.mock.calls[0];
    expect(updateCall![0]).toContain('display_name');
  });

  it('should update home_gym_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ ...fakeUser, home_gym_id: 'g-2' }], rowCount: 1 });

    const result = await updateMe('u-1', { home_gym_id: 'g-2' });

    expect(result.home_gym_id).toBe('g-2');
  });

  it('should update default_visibility', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ ...fakeUser, default_visibility: 'private' }], rowCount: 1 });

    const result = await updateMe('u-1', { default_visibility: 'private' });

    expect(result.default_visibility).toBe('private');
  });

  it('should upload avatar and set avatar_url', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockQuery.mockResolvedValueOnce({ rows: [{ ...fakeUser, avatar_url: 'https://cdn.example.com/avatar.jpg' }], rowCount: 1 });

    const result = await updateMe('u-1', { avatar_base64: 'data:image/png;base64,abc123' });

    expect(uploadBase64Image).toHaveBeenCalledWith('data:image/png;base64,abc123', 'avatars');
    expect(result.avatar_url).toBe('https://cdn.example.com/avatar.jpg');
  });

  it('should throw BAD_REQUEST when no fields provided', async () => {
    try {
      await updateMe('u-1', {});
      fail('Expected AppError');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 });
    }
  });

  it('should throw USERNAME_TAKEN when username is already taken', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'other-user' }], rowCount: 1 });

    try {
      await updateMe('u-1', { username: 'taken_name' });
      fail('Expected AppError');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'USERNAME_TAKEN', statusCode: 409 });
    }
  });

  it('should allow username change when not on cooldown', async () => {
    // Check existing: no conflict
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // Fetch current user: no prior username change
    mockQuery.mockResolvedValueOnce({ rows: [{ username: 'old_name', username_changed_at: null }], rowCount: 1 });
    // UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    // getMe re-fetch
    mockQuery.mockResolvedValueOnce({ rows: [{ ...fakeUser, username: 'new_name' }], rowCount: 1 });

    const result = await updateMe('u-1', { username: 'new_name' });

    expect(result.username).toBe('new_name');
  });

  it('should throw USERNAME_COOLDOWN when changed too recently', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockQuery.mockResolvedValueOnce({
      rows: [{ username: 'old_name', username_changed_at: yesterday }],
      rowCount: 1,
    });

    try {
      await updateMe('u-1', { username: 'new_name' });
      fail('Expected AppError');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'USERNAME_COOLDOWN', statusCode: 429 });
    }
  });

  it('should skip username change when new value matches current', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [{ username: 'same_name', username_changed_at: null }], rowCount: 1 });

    try {
      await updateMe('u-1', { username: 'same_name' });
      fail('Expected AppError');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e).toMatchObject({ code: 'BAD_REQUEST' });
    }
  });
});
