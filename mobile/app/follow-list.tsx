import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { FollowButton } from '@/src/components/FollowButton';
import { useAuthStore } from '@/src/stores/authStore';
import type { PaginatedResponse, UserProfile } from '@shared/types';

export default function FollowListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { mode, username } = useLocalSearchParams<{
    mode: 'followers' | 'following';
    username: string;
  }>();
  const myUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    navigation.setOptions({ title: mode === 'followers' ? 'Followers' : 'Following' });
  }, [mode, navigation]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['follow-list', username, mode],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<UserProfile>>(
        `/users/${username}/${mode}?limit=30${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: Boolean(username && mode),
  });

  const users = data?.pages.flatMap((p) => p.data) ?? [];

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => (
        <UserRow
          user={item}
          myUserId={myUserId}
          onPress={() =>
            router.push({ pathname: '/profile/[username]', params: { username: item.username } })
          }
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
    />
  );
}

function UserRow({
  user,
  myUserId,
  onPress,
}: {
  user: UserProfile;
  myUserId: string | undefined;
  onPress: () => void;
}) {
  const initial = user.display_name[0]?.toUpperCase() ?? '?';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.displayName}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>
      {myUserId && myUserId !== user.id && (
        <FollowButton username={user.username} userId={user.id} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  loader: { paddingVertical: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  username: { fontSize: 13, color: '#6b7280', marginTop: 1 },
});
