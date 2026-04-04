import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
import { SearchHeader, SEARCH_HEADER_CONTENT_HEIGHT } from './components/SearchHeader';
import { FriendsRow } from './components/FriendsRow';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { useFriends, useDiscoverFeed } from '@/src/hooks/useSearchData';
import type { FriendEntry, DiscoveryTile } from './mockSearchData';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + BANNER_HEIGHT + SEARCH_HEADER_CONTENT_HEIGHT + spacing.xl;

  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: tiles = [], isLoading: tilesLoading } = useDiscoverFeed();
  const isLoading = friendsLoading && tilesLoading;

  function handleFriendPress(_friend: FriendEntry) {
    // TODO: navigate to user profile
  }

  function handleTilePress(_tile: DiscoveryTile) {
    // TODO: navigate to ascent detail / gym detail
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
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
  loader: {
    marginTop: spacing.xxxl,
  },
});
