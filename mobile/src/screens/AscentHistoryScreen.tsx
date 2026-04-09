import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { FeedCard } from '@/src/components/FeedCard';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import type { FeedItem, PaginatedResponse } from '@shared/types';

export default function AscentHistoryScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['ascent-history', username],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<FeedItem>>(
        `/users/${username}/ascents?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: Boolean(username),
  });

  const ascents = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load ascent history.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={ascents}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <FeedCard
          item={item}
          onPress={() =>
            router.push({ pathname: '/problem/[id]', params: { id: item.problem.id } })
          }
          onPressUser={() =>
            router.push({ pathname: '/profile/[username]', params: { username: item.user.username } })
          }
          onPressGym={() =>
            router.push({ pathname: '/gym/[gymId]', params: { gymId: item.problem.gym.id } })
          }
        />
      )}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ascents logged yet.</Text>
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : null
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.3}
      contentContainerStyle={ascents.length === 0 ? styles.emptyList : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.error,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  emptyList: {
    flexGrow: 1,
  },
  loader: {
    paddingVertical: spacing.lg,
  },
});
