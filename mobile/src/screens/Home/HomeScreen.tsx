import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { HomeHeader, HEADER_CONTENT_HEIGHT } from './components/HomeHeader';
import { AscentPostCard } from './components/AscentPostCard';
import { GymUpdateCard } from './components/GymUpdateCard';
import type { AscentPostData } from './components/AscentPostCard';
import type { GymUpdateData } from './components/GymUpdateCard';

// ── Mock data ──────────────────────────────────────────────────────────────────

type FeedEntry = AscentPostData | GymUpdateData;

const MOCK_FEED: FeedEntry[] = [
  {
    id: '1',
    type: 'ascent',
    user: {
      name: 'Marcus Thorne',
      avatar: 'https://picsum.photos/seed/marcus/200',
    },
    gym: 'Castle Climbing Centre',
    timeAgo: '2 Hours Ago',
    image: 'https://picsum.photos/seed/climb1/800/1000',
    grade: 'V6',
    ascentType: 'send',
    likes: 128,
    comments: 14,
    liked: true,
    caption:
      'Finally cracked this dynamic start! The slab finish is spicy but the middle section is pure flow. Big thanks to @Sarah_C for the beta.',
  },
  {
    id: '2',
    type: 'gym_update',
    gym: { name: 'The Arch', verified: true },
    title: 'ROUTSETTING WEEK',
    body: "We've just reset the North Wall. 24 new problems ranging from V1 to V8 are waiting for your first ascent tags.",
    image: 'https://picsum.photos/seed/gym1/800/600',
    cta: { label: 'Book Session', action: 'book' },
  },
  {
    id: '3',
    type: 'ascent',
    user: {
      name: 'Sarah Chen',
      avatar: 'https://picsum.photos/seed/sarah/200',
    },
    gym: 'The Arch Climbing Wall',
    timeAgo: '5 Hours Ago',
    image: 'https://picsum.photos/seed/climb2/800/1000',
    grade: 'V4',
    ascentType: 'flash',
    likes: 54,
    comments: 7,
    liked: false,
    caption:
      'Flash! This new turquoise set on the slab wall is so much fun. Perfect warm-up problem.',
  },
];

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const topPadding = insets.top + HEADER_CONTENT_HEIGHT + spacing.lg;

  function renderItem({ item }: { item: FeedEntry }) {
    if (item.type === 'gym_update') {
      return <GymUpdateCard item={item} />;
    }
    return <AscentPostCard item={item} />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={MOCK_FEED}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
      />
      <HomeHeader onNotificationsPress={() => console.log('Notifications')} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.xl + spacing.lg,
  },
});
