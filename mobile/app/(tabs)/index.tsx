import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import { FeedCard } from '@/src/components/FeedCard';
import type { FeedItem, PaginatedResponse } from '../../../shared/types';

const FEED_LIMIT = 20;
const GYM_PREVIEW_LIMIT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const homeGymId = useAuthStore((s) => s.user?.home_gym_id);
  const homeGymName = useAuthStore((s) => s.user?.home_gym_name ?? null);

  // Personal feed — infinite scroll
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: feedLoading,
    isRefetching: feedRefetching,
    refetch: refetchFeed,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<FeedItem>>(
        `/feed?limit=${FEED_LIMIT}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
  });

  // Gym preview — capped at 5 items
  const { data: gymFeedData, isLoading: gymLoading } = useQuery({
    queryKey: ['feed', 'gym', homeGymId],
    queryFn: () =>
      api.get<PaginatedResponse<FeedItem>>(`/feed/gym/${homeGymId}?limit=${GYM_PREVIEW_LIMIT}`),
    enabled: Boolean(homeGymId),
  });

  const feedItems = feedData?.pages.flatMap((p) => p.data) ?? [];
  const gymItems = gymFeedData?.data ?? [];

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function renderGymSection() {
    if (!homeGymId) {
      return (
        <Pressable style={styles.gymPrompt} onPress={() => router.push('/(tabs)/account')}>
          <Text style={styles.gymPromptText}>Set your home gym to see local activity</Text>
          <Text style={styles.gymPromptLink}>Go to Account →</Text>
        </Pressable>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent at {homeGymName ?? 'your gym'}</Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/feed/gym', params: { gymId: homeGymId! } })
            }>
            <Text style={styles.seeMore}>See more</Text>
          </Pressable>
        </View>
        {gymLoading ? (
          <ActivityIndicator style={styles.smallLoader} />
        ) : gymItems.length === 0 ? (
          <Text style={styles.emptyText}>No recent activity at this gym.</Text>
        ) : (
          gymItems.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onPress={() => router.push({ pathname: '/problem/[id]', params: { id: item.problem.id } })}
              onPressUser={() => router.push({ pathname: '/profile/[username]', params: { username: item.user.username } })}
              onPressGym={() => router.push({ pathname: '/gym/[gymId]', params: { gymId: item.problem.gym.id } })}
            />
          ))
        )}
      </View>
    );
  }

  if (feedLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={feedItems}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedCard
          item={item}
          onPress={() => router.push({ pathname: '/problem/[id]', params: { id: item.problem.id } })}
          onPressUser={() => router.push({ pathname: '/profile/[username]', params: { username: item.user.username } })}
          onPressGym={() => router.push({ pathname: '/gym/[gymId]', params: { gymId: item.problem.gym.id } })}
        />
      )}
      ListHeaderComponent={
        <View>
          {renderGymSection()}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Friends activity</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>Follow some climbers to see their activity.</Text>
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.smallLoader} /> : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={feedRefetching} onRefresh={refetchFeed} />}
      contentContainerStyle={feedItems.length === 0 ? styles.emptyContainer : undefined}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flexGrow: 1 },

  section: { borderBottomWidth: 4, borderColor: '#f3f4f6' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeMore: { fontSize: 14, color: '#2563eb', fontWeight: '500' },

  gymPrompt: { margin: 16, padding: 16, backgroundColor: '#eff6ff', borderRadius: 12, gap: 4 },
  gymPromptText: { fontSize: 14, color: '#1e40af' },
  gymPromptLink: { fontSize: 14, color: '#2563eb', fontWeight: '600' },

  emptyText: { paddingHorizontal: 16, paddingVertical: 24, color: '#6b7280', fontSize: 14 },
  smallLoader: { paddingVertical: 16 },
});
