import { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { navigate } from '@/src/lib/navigation';
import { classifyError } from '@/src/lib/queryClient';
import { useAuthStore } from '@/src/stores/authStore';
import { useFollowStore } from '@/src/stores/followStore';
import type { AuthUser, FeedItem, PaginatedResponse } from '@shared/types';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { ListSkeleton } from '@/src/components/ui/ListSkeleton';
import { ProfileHeader } from './components/ProfileHeader';
import { ActionButtons } from './components/ActionButtons';
import { RecentActivity } from './components/RecentActivity';
import type { AscentActivity } from './components/ActivityCard';

// ── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function feedItemToActivity(item: FeedItem): AscentActivity {
  return {
    id: item.id,
    problemId: item.problem.id,
    colour: capitalize(item.problem.colour),
    grade: item.problem.consensus_grade ?? item.user_grade ?? 'Ungraded',
    gymName: item.problem.gym.name,
    imageUrl: null,
    ascentType: item.type,
    createdAt: item.logged_at,
  };
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { load: loadFollowing, reset: resetFollowing } = useFollowStore();

  const accessToken = useAuthStore((s) => s.accessToken);

  const {
    data: profile,
    isLoading,
    error,
    refetch: refetchProfile,
  } = useQuery<AuthUser>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<AuthUser>('/users/me'),
    enabled: !!accessToken,
  });

  const {
    data: ascentsPage,
    error: ascentsError,
    isLoading: ascentsLoading,
    refetch: refetchAscents,
  } = useQuery<PaginatedResponse<FeedItem>>({
    queryKey: ['users', profile?.username, 'ascents'],
    queryFn: () =>
      api.get<PaginatedResponse<FeedItem>>(`/users/${profile!.username}/ascents?limit=5`),
    enabled: !!profile?.username,
  });

  useEffect(() => {
    if (profile?.username) {
      void loadFollowing(profile.username);
    }
  }, [profile?.username, loadFollowing]);

  function handleEditProfile() {
    navigate(router, { pathname: '/edit-profile' });
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          resetFollowing();
          logout();
          // Root _layout.tsx auth gate redirects to login
        },
      },
    ]);
  }

  function handleFollowers() {
    if (!profile) return;
    navigate(router, {
      pathname: '/follow-list',
      params: { mode: 'followers', username: profile.username },
    });
  }

  function handleFollowing() {
    if (!profile) return;
    navigate(router, {
      pathname: '/follow-list',
      params: { mode: 'following', username: profile.username },
    });
  }

  function handleViewAll() {
    if (!profile) return;
    navigate(router, {
      pathname: '/ascent-history/[username]',
      params: { username: profile.username },
    });
  }

  function handleActivityPress(activity: AscentActivity) {
    navigate(router, { pathname: '/problem/[id]', params: { id: activity.problemId } });
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.skeletonWrapper, { paddingTop: insets.top + BANNER_HEIGHT + spacing.xl }]}>
          <ListSkeleton count={2} />
        </View>
        <CruxBanner />
      </View>
    );
  }

  if (error != null || profile == null) {
    return (
      <View style={styles.screen}>
        <View style={[styles.errorWrapper, { paddingTop: insets.top + BANNER_HEIGHT }]}>
          <ErrorState
            message={classifyError(error)}
            onRetry={() => void refetchProfile()}
          />
        </View>
        <CruxBanner />
      </View>
    );
  }

  const showAscentsError = ascentsError != null;
  const showAscentsSkeleton = ascentsLoading && !ascentsPage;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + BANNER_HEIGHT + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          profile={profile}
          onFollowersPress={handleFollowers}
          onFollowingPress={handleFollowing}
        />

        <ActionButtons onEditProfile={handleEditProfile} onSignOut={handleSignOut} />

        {showAscentsSkeleton ? (
          <ListSkeleton count={2} />
        ) : showAscentsError ? (
          <ErrorState
            message={classifyError(ascentsError)}
            onRetry={() => void refetchAscents()}
          />
        ) : (
          <RecentActivity
            activities={(ascentsPage?.data ?? []).map(feedItemToActivity)}
            onViewAll={handleViewAll}
            onActivityPress={handleActivityPress}
          />
        )}
      </ScrollView>
      <CruxBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  skeletonWrapper: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  errorWrapper: {
    flex: 1,
  },
});
