import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { api } from '@/src/lib/api';
import { FollowButton } from '@/src/components/FollowButton';
import { FeedCard } from '@/src/components/FeedCard';
import { useAuthStore } from '@/src/stores/authStore';
import type { FeedItem, PaginatedResponse, UserProfile } from '../../../shared/types';

function ProfileHeader({ profile, isOwnProfile }: { profile: UserProfile; isOwnProfile: boolean }) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{profile.display_name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}

      <Text style={styles.displayName}>{profile.display_name}</Text>
      <Text style={styles.usernameText}>@{profile.username}</Text>

      <View style={styles.statsRow}>
        <AccessiblePressable
          accessibilityLabel={`${profile.follower_count} followers`}
          style={styles.statItem}
          onPress={() =>
            router.push({
              pathname: '/follow-list',
              params: { mode: 'followers', username: profile.username },
            })
          }
        >
          <Text style={styles.statNumber}>{profile.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </AccessiblePressable>
        <View style={styles.statDivider} />
        <AccessiblePressable
          accessibilityLabel={`${profile.following_count} following`}
          style={styles.statItem}
          onPress={() =>
            router.push({
              pathname: '/follow-list',
              params: { mode: 'following', username: profile.username },
            })
          }
        >
          <Text style={styles.statNumber}>{profile.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </AccessiblePressable>
      </View>

      {!isOwnProfile && (
        <View style={styles.followRow}>
          <FollowButton username={profile.username} userId={profile.id} />
        </View>
      )}

      <View style={styles.activityHeader}>
        <Text style={styles.activityTitle}>Recent ascents</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const myUserId = useAuthStore((s) => s.user?.id);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['users', username],
    queryFn: () => api.get<UserProfile>(`/users/${username}`),
    enabled: Boolean(username),
  });

  const {
    data: ascentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['user-ascents', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<FeedItem>>(
        `/users/${username}/ascents?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: Boolean(username),
  });

  useEffect(() => {
    if (profile) navigation.setOptions({ title: profile.display_name });
  }, [profile, navigation]);

  if (profileLoading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const isOwnProfile = myUserId === profile.id;
  const ascents = ascentsData?.pages.flatMap((p) => p.data) ?? [];

  return (
    <FlatList
      data={ascents}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedCard
          item={item}
          onPress={() =>
            router.push({ pathname: '/problem/[id]', params: { id: item.problem.id } })
          }
        />
      )}
      ListHeaderComponent={<ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />}
      ListEmptyComponent={<Text style={styles.empty}>No public ascents yet.</Text>}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.3}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { alignItems: 'center', padding: 24, gap: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 4 },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: { color: '#fff', fontSize: 32, fontWeight: '700' },
  displayName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  usernameText: { fontSize: 15, color: '#6b7280', textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center', padding: 14 },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e5e7eb' },

  followRow: { marginTop: 4 },

  activityHeader: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  activityTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  loader: { paddingVertical: 16 },
});
