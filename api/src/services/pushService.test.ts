jest.mock('../db/pool', () => require('../test/dbMock').poolModule);
jest.mock('expo-server-sdk', () => {
  const mockSend = jest.fn();
  const mockChunk = jest.fn();
  return {
    Expo: Object.assign(
      jest.fn().mockImplementation(() => ({
        sendPushNotificationsAsync: mockSend,
        chunkPushNotifications: mockChunk,
      })),
      { isExpoPushToken: jest.fn() },
    ),
    __mockSend: mockSend,
    __mockChunk: mockChunk,
  };
});

import { mockQuery, resetMock } from '../test/dbMock';
import { registerToken, removeToken, sendToUser } from './pushService';
import { Expo } from 'expo-server-sdk';

const { __mockSend, __mockChunk } = require('expo-server-sdk');

beforeEach(() => {
  resetMock();
  __mockSend.mockReset();
  __mockChunk.mockReset();
  (Expo.isExpoPushToken as unknown as jest.Mock).mockReset();
});

describe('registerToken', () => {
  it('should insert token with ON CONFLICT DO NOTHING', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await registerToken('u-1', 'ExponentPushToken[abc]');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]![1]).toEqual(['u-1', 'ExponentPushToken[abc]']);
    expect(mockQuery.mock.calls[0]![0]).toContain('ON CONFLICT');
  });
});

describe('removeToken', () => {
  it('should delete token from push_tokens', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await removeToken('ExponentPushToken[abc]');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0]![1]).toEqual(['ExponentPushToken[abc]']);
    expect(mockQuery.mock.calls[0]![0]).toContain('DELETE');
  });
});

describe('sendToUser', () => {
  it('should do nothing when user has no tokens', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await sendToUser('u-1', 'Title', 'Body');

    expect(__mockSend).not.toHaveBeenCalled();
  });

  it('should do nothing when no tokens are valid Expo tokens', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ token: 'invalid-token' }], rowCount: 1 });
    (Expo.isExpoPushToken as unknown as jest.Mock).mockReturnValue(false);

    await sendToUser('u-1', 'Title', 'Body');

    expect(__mockSend).not.toHaveBeenCalled();
  });

  it('should send push notifications for valid tokens', async () => {
    const token = 'ExponentPushToken[valid]';
    mockQuery.mockResolvedValueOnce({ rows: [{ token }], rowCount: 1 });
    (Expo.isExpoPushToken as unknown as jest.Mock).mockReturnValue(true);

    const messages = [{ to: token, title: 'Title', body: 'Body', data: undefined }];
    __mockChunk.mockReturnValue([messages]);
    __mockSend.mockResolvedValue([{ status: 'ok', id: 'ticket-1' }]);

    await sendToUser('u-1', 'Title', 'Body');

    expect(__mockChunk).toHaveBeenCalledWith(messages);
    expect(__mockSend).toHaveBeenCalledWith(messages);
  });

  it('should remove stale tokens on DeviceNotRegistered error', async () => {
    const token = 'ExponentPushToken[stale]';
    mockQuery.mockResolvedValueOnce({ rows: [{ token }], rowCount: 1 });
    (Expo.isExpoPushToken as unknown as jest.Mock).mockReturnValue(true);

    const messages = [{ to: token, title: 'Title', body: 'Body', data: undefined }];
    __mockChunk.mockReturnValue([messages]);
    __mockSend.mockResolvedValue([{
      status: 'error',
      message: 'Device not registered',
      details: { error: 'DeviceNotRegistered' },
    }]);
    // DELETE stale tokens
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await sendToUser('u-1', 'Title', 'Body');

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1]![0]).toContain('DELETE');
    expect(mockQuery.mock.calls[1]![1]).toEqual([['ExponentPushToken[stale]']]);
  });

  it('should continue on send chunk failure', async () => {
    const token = 'ExponentPushToken[valid]';
    mockQuery.mockResolvedValueOnce({ rows: [{ token }], rowCount: 1 });
    (Expo.isExpoPushToken as unknown as jest.Mock).mockReturnValue(true);

    const messages = [{ to: token, title: 'Title', body: 'Body', data: { key: 'val' } }];
    __mockChunk.mockReturnValue([messages]);
    __mockSend.mockRejectedValue(new Error('Network error'));

    // Should not throw
    await sendToUser('u-1', 'Title', 'Body', { key: 'val' });
  });
});
