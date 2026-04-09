import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFollowStore } from '../stores/followStore';
import { ApiError } from '../lib/api';
import { AccessiblePressable } from './ui/AccessiblePressable';

interface FollowButtonProps {
  username: string;
  userId: string;
}

export function FollowButton({ username, userId }: FollowButtonProps) {
  const queryClient = useQueryClient();
  const { follow, unfollow, isFollowing } = useFollowStore();
  const [isPending, setIsPending] = useState(false);

  const following = isFollowing(userId);

  async function handlePress() {
    if (isPending) return;
    setIsPending(true);
    try {
      if (following) {
        await unfollow(username, userId);
      } else {
        await follow(username, userId);
      }
      // Invalidate profile so follower counts refresh
      void queryClient.invalidateQueries({ queryKey: ['users', username] });
    } catch (e) {
      // Optimistic rollback is handled in the store; surface nothing to the user
      // since the store already reverted — a silent failure is fine here.
      if (!(e instanceof ApiError)) console.error(e);
    } finally {
      setIsPending(false);
    }
  }

  const accessibilityLabel = following ? `Unfollow ${username}` : `Follow ${username}`;

  return (
    <AccessiblePressable
      style={[styles.button, following ? styles.following : styles.follow]}
      onPress={handlePress}
      disabled={isPending}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isPending, selected: following, busy: isPending }}
    >
      {isPending ? (
        <ActivityIndicator size="small" color={following ? '#374151' : '#fff'} />
      ) : (
        <Text style={[styles.label, following ? styles.labelFollowing : styles.labelFollow]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      )}
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  follow: { backgroundColor: '#2563eb' },
  following: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  label: { fontSize: 14, fontWeight: '600' },
  labelFollow: { color: '#fff' },
  labelFollowing: { color: '#374151' },
});
