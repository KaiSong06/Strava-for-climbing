import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { SearchHeader, SEARCH_HEADER_CONTENT_HEIGHT } from './components/SearchHeader';
import { FriendsRow } from './components/FriendsRow';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { MOCK_FRIENDS, MOCK_TILES } from './mockSearchData';
import type { FriendEntry, DiscoveryTile } from './mockSearchData';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + SEARCH_HEADER_CONTENT_HEIGHT + spacing.xl;

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
        <FriendsRow
          friends={MOCK_FRIENDS}
          onFriendPress={handleFriendPress}
        />
        <DiscoveryGrid
          tiles={MOCK_TILES}
          onTilePress={handleTilePress}
        />
      </ScrollView>
      <SearchHeader onFilterPress={() => {}} />
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
