import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFollowStore } from '../stores/followStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { AccessiblePressable } from './ui/AccessiblePressable';

interface FollowButtonProps {
  username: string;
  userId: string;
}

export function FollowButton({ username, userId }: FollowButtonProps) {
  const queryClient = useQueryClient();
  const { follow, unfollow, isFollowing } = useFollowStore();

  const following = isFollowing(userId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (following) {
        await unfollow(username, userId);
      } else {
        await follow(username, userId);
      }
    },
    onSuccess: () => {
      // Refresh follower counts on the profile screen
      void queryClient.invalidateQueries({ queryKey: ['users', username] });
    },
    // onError intentionally omitted — the global QueryClient mutation
    // handler classifies the error and surfaces a toast. The follow store
    // already rolled back the optimistic state before re-throwing.
  });

  const isPending = mutation.isPending;

  function handlePress() {
    if (isPending) return;
    mutation.mutate();
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
        <ActivityIndicator
          size="small"
          color={following ? colors.onSurface : colors.onPrimary}
        />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.xl,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  follow: { backgroundColor: colors.primaryContainer },
  following: { backgroundColor: colors.surfaceContainerHigh },
  label: {
    ...typography.bodyMd,
    fontFamily: 'Inter_700Bold',
  },
  labelFollow: { color: colors.onPrimary },
  labelFollowing: { color: colors.onSurface },
});
