import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { classifyError } from '@/src/lib/queryClient';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { ListSkeleton } from '@/src/components/ui/ListSkeleton';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
import { SearchHeader, SEARCH_HEADER_CONTENT_HEIGHT } from './components/SearchHeader';
import { FriendsRow } from './components/FriendsRow';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { useFriends, useDiscoverFeed } from '@/src/hooks/useSearchData';
import type { FriendEntry, DiscoveryTile } from './searchTypes';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = insets.top + BANNER_HEIGHT + SEARCH_HEADER_CONTENT_HEIGHT + spacing.xl;

  const {
    data: friends = [],
    isLoading: friendsLoading,
    error: friendsError,
    refetch: refetchFriends,
  } = useFriends();
  const {
    data: tiles = [],
    isLoading: tilesLoading,
    error: tilesError,
    refetch: refetchTiles,
  } = useDiscoverFeed();
  const isLoading = friendsLoading && tilesLoading;
  const error = friendsError ?? tilesError;

  function handleFriendPress(friend: FriendEntry) {
    const username = friend.username.replace(/^@/, '');
    router.push({ pathname: '/profile/[username]', params: { username } } as Parameters<typeof router.push>[0]);
  }

  function handleTilePress(tile: DiscoveryTile) {
    if (tile.type === 'gym_spotlight' && tile.gymId) {
      router.push({ pathname: '/gym/[gymId]', params: { gymId: tile.gymId } } as Parameters<typeof router.push>[0]);
    } else if (tile.problemId) {
      router.push({ pathname: '/problem/[id]', params: { id: tile.problemId } } as Parameters<typeof router.push>[0]);
    }
  }

  function handleRetry() {
    if (friendsError) void refetchFriends();
    if (tilesError) void refetchTiles();
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : error ? (
          <ErrorState message={classifyError(error)} onRetry={handleRetry} />
        ) : (
          <>
            <FriendsRow friends={friends} onFriendPress={handleFriendPress} />
            <DiscoveryGrid tiles={tiles} onTilePress={handleTilePress} />
          </>
        )}
      </ScrollView>
      <SearchHeader bannerHeight={BANNER_HEIGHT} />
      <CruxBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
