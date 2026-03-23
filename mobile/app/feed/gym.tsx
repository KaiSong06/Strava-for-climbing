import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/src/lib/api';
import { FeedCard } from '@/src/components/FeedCard';
import type { FeedItem, Gym, PaginatedResponse } from '../../../shared/types';

export default function GymFeedScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const { data: gymData } = useQuery({
    queryKey: ['gyms', gymId],
    queryFn: () => api.get<{ data: Gym[] }>('/gyms'),
    select: (d) => d.data.find((g) => g.id === gymId),
    enabled: Boolean(gymId),
  });

  useEffect(() => {
    if (gymData) navigation.setOptions({ title: gymData.name });
  }, [gymData, navigation]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['feed', 'gym', gymId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<FeedItem>>(
        `/feed/gym/${gymId}?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: Boolean(gymId),
  });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedCard
          item={item}
          onPress={() => router.push({ pathname: '/problem/[id]', params: { id: item.problem.id } })}
          onPressUser={() => router.push({ pathname: '/profile/[username]', params: { username: item.user.username } })}
          onPressGym={() => router.push({ pathname: '/gym/[gymId]', params: { gymId: item.problem.gym.id } })}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No recent activity at this gym.</Text>}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.3}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  loader: { paddingVertical: 16 },
});
