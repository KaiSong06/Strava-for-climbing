import { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import { useFollowStore } from '@/src/stores/followStore';
import type { AuthUser } from '../../../../shared/types';
import { colors } from '@/src/theme/colors';
import { ProfileHeader } from './components/ProfileHeader';
import { ActionButtons } from './components/ActionButtons';
import { RecentActivity } from './components/RecentActivity';
import type { AscentActivity } from './components/ActivityCard';

// ── Mock data (replace with API call once ascents endpoint is wired) ────────

const MOCK_ACTIVITIES: AscentActivity[] = [
  {
    id: '1',
    problemName: 'Midnight Dyno Project',
    grade: 'V5',
    imageUrl: null,
    tags: ['Crimps', 'Overhang', 'Dyno'],
    ascentType: 'flash',
    createdAt: '2026-03-20T10:00:00Z',
  },
  {
    id: '2',
    problemName: 'Morning Slab Flow',
    grade: 'V3',
    imageUrl: null,
    tags: ['Technical', 'Balance', 'Footwork'],
    ascentType: 'send',
    createdAt: '2026-03-18T09:00:00Z',
  },
];

// ── Screen ──────────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { load: loadFollowing, reset: resetFollowing } = useFollowStore();

  const { data: profile, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<AuthUser>('/users/me'),
  });

  useEffect(() => {
    if (profile?.username) {
      void loadFollowing(profile.username);
    }
  }, [profile?.username, loadFollowing]);

  function handleEditProfile() {
    // TODO: navigate to EditProfile screen once implemented
    Alert.alert('Coming Soon', 'Edit Profile will be available in a future update.');
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
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error != null || profile == null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load profile.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader
        profile={profile}
        onFollowersPress={handleFollowers}
        onFollowingPress={handleFollowing}
      />

      <ActionButtons onEditProfile={handleEditProfile} onSignOut={handleSignOut} />

      <RecentActivity
        activities={MOCK_ACTIVITIES}
        onViewAll={handleViewAll}
        onActivityPress={handleActivityPress}
      />
    </ScrollView>
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
