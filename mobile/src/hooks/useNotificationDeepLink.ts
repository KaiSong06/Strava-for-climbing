import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import type { UploadStatusResponse } from '../services/uploadService';

/**
 * Notification data payloads sent by the API.
 *
 * `vision_complete` — upload processed successfully (matched or awaiting_confirmation).
 * `vision_failed`   — vision pipeline failed.
 * `new_follower`    — someone followed the user.
 */
interface VisionNotificationData {
  type: 'vision_complete' | 'vision_failed';
  uploadId: string;
}

interface FollowerNotificationData {
  type: 'new_follower';
  username: string;
}

type NotificationData = VisionNotificationData | FollowerNotificationData;

function parseNotificationData(data: Record<string, unknown>): NotificationData | null {
  const { type } = data;
  if (type === 'vision_complete' || type === 'vision_failed') {
    if (typeof data['uploadId'] === 'string') {
      return { type, uploadId: data['uploadId'] };
    }
  }
  if (type === 'new_follower') {
    if (typeof data['username'] === 'string') {
      return { type, username: data['username'] };
    }
  }
  return null;
}

/**
 * Handles push notification deep linking for both cold-start and
 * warm (backgrounded) scenarios.
 *
 * Navigation targets:
 *  - vision_complete + matched       -> /problem/[id]
 *  - vision_complete + awaiting_confirmation -> /(tabs)/record (user needs to confirm)
 *  - vision_failed                   -> /(tabs)/record
 *  - new_follower                    -> /profile/[username]
 *  - unknown type                    -> no-op (app just opens)
 */
export function useNotificationDeepLink(): void {
  // Push notifications are not available on web. Platform.OS is constant for
  // the lifetime of the JS bundle, so calling the underlying hook conditionally
  // is safe — but the lint rule can't statically prove that.
  if (Platform.OS === 'web') return;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useNotificationDeepLinkNative();
}

function useNotificationDeepLinkNative(): void {
  const router = useRouter();
  const processedResponseIds = useRef(new Set<string>());

  const handleNotification = useCallback(
    async (data: NotificationData): Promise<void> => {
      switch (data.type) {
        case 'vision_complete': {
          try {
            const status = await api.get<UploadStatusResponse>(
              `/uploads/${data.uploadId}/status`,
            );
            if (status.status === 'matched' && status.matchedProblemId) {
              router.push({
                pathname: '/problem/[id]',
                params: { id: status.matchedProblemId },
              });
            } else {
              router.push('/(tabs)/record');
            }
          } catch {
            router.push('/(tabs)/record');
          }
          break;
        }
        case 'vision_failed': {
          router.push('/(tabs)/record');
          break;
        }
        case 'new_follower': {
          router.push({
            pathname: '/profile/[username]',
            params: { username: data.username },
          });
          break;
        }
      }
    },
    [router],
  );

  const processResponse = useCallback(
    (response: Notifications.NotificationResponse): void => {
      const responseId = response.notification.request.identifier;
      if (processedResponseIds.current.has(responseId)) return;
      processedResponseIds.current.add(responseId);

      const raw = response.notification.request.content.data as Record<string, unknown>;
      const data = parseNotificationData(raw);
      if (data) {
        void handleNotification(data);
      }
    },
    [handleNotification],
  );

  // ── Cold start: read the notification that launched the app ──────────────
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastResponse) {
      processResponse(lastResponse);
    }
  }, [lastResponse, processResponse]);

  // ── Warm / backgrounded: listen for taps while app is running ───────────
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      processResponse,
    );
    return () => subscription.remove();
  }, [processResponse]);
}
