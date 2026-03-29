import { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import { useFollowStore } from '@/src/stores/followStore';
import type { AuthUser, FeedItem, PaginatedResponse } from '../../../../shared/types';
import { colors } from '@/src/theme/colors';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
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

  const { data: profile, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<AuthUser>('/users/me'),
    enabled: !!accessToken,
  });

  const { data: ascentsPage } = useQuery<PaginatedResponse<FeedItem>>({
    queryKey: ['users', profile?.username, 'ascents'],
    queryFn: () =>
      api.get<PaginatedResponse<FeedItem>>(
        `/users/${profile!.username}/ascents?limit=5`,
      ),
    enabled: !!profile?.username,
  });

  useEffect(() => {
    if (profile?.username) {
      void loadFollowing(profile.username);
    }
  }, [profile?.username, loadFollowing]);

  function handleEditProfile() {
    router.push('/edit-profile' as Parameters<typeof router.push>[0]);
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
    router.push({
      pathname: '/follow-list',
      params: { mode: 'followers', username: profile.username },
    } as Parameters<typeof router.push>[0]);
  }

  function handleFollowing() {
    if (!profile) return;
    router.push({
      pathname: '/follow-list',
      params: { mode: 'following', username: profile.username },
    } as Parameters<typeof router.push>[0]);
  }

  function handleViewAll() {
    // TODO: navigate to full ascent history once implemented
  }

  function handleActivityPress() {
    // TODO: navigate to ascent detail once implemented
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + BANNER_HEIGHT }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <CruxBanner />
      </View>
    );
  }

  if (error != null || profile == null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + BANNER_HEIGHT }]}>
        <Text style={styles.errorText}>Failed to load profile.</Text>
        <CruxBanner />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + BANNER_HEIGHT + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          profile={profile}
          onFollowersPress={handleFollowers}
          onFollowingPress={handleFollowing}
        />

        <ActionButtons onEditProfile={handleEditProfile} onSignOut={handleSignOut} />

        <RecentActivity
          activities={(ascentsPage?.data ?? []).map(feedItemToActivity)}
          onViewAll={handleViewAll}
          onActivityPress={handleActivityPress}
        />
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
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
  },
});
