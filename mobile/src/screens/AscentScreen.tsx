import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import type { AscentType, AscentVisibility } from '../../../shared/types';

interface AscentDetail {
  id: string;
  type: AscentType;
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  visibility: AscentVisibility;
  logged_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  problem: {
    id: string;
    colour: string;
    consensus_grade: string | null;
    gym: { id: string; name: string };
  };
  photo_urls: string[];
}

const TYPE_BADGE: Record<AscentType, { label: string; fg: string; bg: string }> = {
  flash: { label: 'FLASH', fg: '#92400e', bg: '#fef3c7' },
  send: { label: 'SEND', fg: '#065f46', bg: '#d1fae5' },
  attempt: { label: 'ATTEMPT', fg: '#1e40af', bg: '#dbeafe' },
};

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text
          key={i}
          style={[styles.star, i < rating ? styles.starFilled : styles.starEmpty]}
        >
          {'\u2605'}
        </Text>
      ))}
    </View>
  );
}

function PhotoCarousel({ urls }: { urls: string[] }) {
  return (
    <FlatList
      data={urls}
      keyExtractor={(url, i) => `${url}-${i}`}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <Image
          source={{ uri: item }}
          style={styles.carouselImage}
          resizeMode="cover"
        />
      )}
      style={styles.carousel}
    />
  );
}

export default function AscentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: ascent, isLoading, isError } = useQuery({
    queryKey: ['ascent', id],
    queryFn: () => api.get<AscentDetail>(`/ascents/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !ascent) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Ascent not found.</Text>
      </View>
    );
  }

  const badge = TYPE_BADGE[ascent.type];
  const initial = ascent.user.display_name[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
    >
      {/* User row */}
      <AccessiblePressable
        style={styles.userRow}
        onPress={() =>
          router.push({
            pathname: '/profile/[username]',
            params: { username: ascent.user.username },
          })
        }
        accessibilityLabel={`Open profile for ${ascent.user.display_name}`}
        accessibilityRole="button"
      >
        {ascent.user.avatar_url ? (
          <Image
            source={{ uri: ascent.user.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{ascent.user.display_name}</Text>
          <Text style={styles.username}>@{ascent.user.username}</Text>
        </View>
        <Text style={styles.timestamp}>{formatTimestamp(ascent.logged_at)}</Text>
      </AccessiblePressable>

      {/* Photo carousel */}
      {ascent.photo_urls.length > 0 && (
        <PhotoCarousel urls={ascent.photo_urls} />
      )}

      {/* Problem card — tappable */}
      <AccessiblePressable
        style={styles.problemCard}
        onPress={() =>
          router.push({
            pathname: '/problem/[id]',
            params: { id: ascent.problem.id },
          })
        }
        accessibilityLabel={`Open problem at ${ascent.problem.gym.name}, grade ${ascent.problem.consensus_grade ?? 'ungraded'}`}
        accessibilityRole="button"
      >
        <View
          style={[styles.colourSwatch, { backgroundColor: ascent.problem.colour }]}
        />
        <View style={styles.problemInfo}>
          <Text style={styles.problemGrade}>
            {ascent.problem.consensus_grade ?? 'Ungraded'}
          </Text>
          <Text style={styles.gymName}>{ascent.problem.gym.name}</Text>
        </View>
        <Text style={styles.chevron}>{'\u203A'}</Text>
      </AccessiblePressable>

      {/* Ascent type badge + user grade */}
      <View style={styles.detailSection}>
        <View style={styles.badgeGradeRow}>
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.typeBadgeText, { color: badge.fg }]}>
              {badge.label}
            </Text>
          </View>
          {ascent.user_grade && (
            <Text style={styles.userGrade}>{ascent.user_grade}</Text>
          )}
        </View>

        {/* Star rating */}
        {ascent.rating !== null && (
          <View style={styles.ratingRow}>
            <Text style={styles.fieldLabel}>Rating</Text>
            <StarRating rating={ascent.rating} />
          </View>
        )}

        {/* Notes */}
        {ascent.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <Text style={styles.notesText}>{ascent.notes}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },

  // ── User row ──────────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceContainerLow,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.bodyLg,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  displayName: {
    ...typography.bodyLg,
    color: colors.onSurface,
    fontWeight: '700',
  },
  username: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  timestamp: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },

  // ── Photo carousel ────────────────────────────────────────
  carousel: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },

  // ── Problem card ──────────────────────────────────────────
  problemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surfaceContainer,
  },
  colourSwatch: {
    width: 40,
    height: 40,
    borderRadius: spacing.sm,
  },
  problemInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  problemGrade: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  gymName: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  chevron: {
    ...typography.headlineLg,
    color: colors.onSurfaceVariant,
  },

  // ── Detail section ────────────────────────────────────────
  detailSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    backgroundColor: colors.background,
  },
  badgeGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.lg,
  },
  typeBadgeText: {
    ...typography.labelMd,
    letterSpacing: 1.5,
  },
  userGrade: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },

  // ── Rating ────────────────────────────────────────────────
  ratingRow: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  star: {
    fontSize: 22,
  },
  starFilled: {
    color: colors.tertiary,
  },
  starEmpty: {
    color: colors.outlineVariant,
  },

  // ── Notes ─────────────────────────────────────────────────
  notesSection: {
    gap: spacing.sm,
  },
  notesText: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
});
