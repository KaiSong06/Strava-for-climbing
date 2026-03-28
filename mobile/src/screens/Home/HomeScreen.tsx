import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import type { FeedItem, PaginatedResponse } from '../../../../shared/types';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { HomeHeader, HEADER_CONTENT_HEIGHT } from './components/HomeHeader';
import { AscentPostCard } from './components/AscentPostCard';
import type { AscentPostData } from './components/AscentPostCard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function feedItemToCard(item: FeedItem): AscentPostData {
  return {
    id: item.id,
    type: item.type,
    user_grade: item.user_grade,
    rating: item.rating,
    logged_at: item.logged_at,
    notes: item.notes,
    display_name: item.user.display_name,
    photo_urls: item.photo_urls,
    avatar_url: item.user.avatar_url,
  };
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + HEADER_CONTENT_HEIGHT + spacing.lg;
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading, error } = useQuery<PaginatedResponse<FeedItem>>({
    queryKey: ['feed'],
    queryFn: () => api.get<PaginatedResponse<FeedItem>>('/feed'),
    enabled: !!accessToken,
  });

  const cards = data?.data.map(feedItemToCard) ?? [];

  return (
    <View style={styles.screen}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AscentPostCard item={item} />}
        contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <Text style={styles.emptyText}>Could not load feed.</Text>
          ) : (
            <Text style={styles.emptyText}>
              Follow climbers to see their ascents here.
            </Text>
          )
        }
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
  loader: {
    marginTop: spacing.xxxl,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
});
