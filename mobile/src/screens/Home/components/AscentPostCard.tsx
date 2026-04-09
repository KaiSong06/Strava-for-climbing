import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';
import { formatRelativeTime } from '@/src/lib/formatRelativeTime';

export interface AscentPostData {
  id: string;
  type: 'flash' | 'send' | 'attempt';
  user_grade: string | null;
  rating: number | null;
  logged_at: string;
  notes: string | null;
  display_name: string;
  photo_urls: string[];
  avatar_url: string | null;
}

function badgeLabel(userGrade: string | null, type: AscentPostData['type']): string {
  const grade = userGrade ?? '';
  switch (type) {
    case 'flash':
      return grade ? `${grade} FLASH ⚡` : 'FLASH ⚡';
    case 'attempt':
      return grade ? `${grade} ATTEMPT` : 'ATTEMPT';
    default:
      return grade ? `NEW ${grade} SEND` : 'NEW SEND';
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <MaterialCommunityIcons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color={i <= rating ? colors.primary : colors.onSurfaceVariant}
        />
      ))}
    </View>
  );
}

// TODO: Sprint 3 — wire up feed interactions (menu, like, comments, share, bookmark)
const noop = () => {};

export function AscentPostCard({ item }: { item: AscentPostData }) {
  const photo = item.photo_urls[0];

  return (
    <View style={styles.card}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{item.display_name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <View>
            <Text style={styles.userName}>{item.display_name}</Text>
            <Text style={styles.meta}>{formatRelativeTime(item.logged_at)}</Text>
          </View>
        </View>
        <AccessiblePressable
          accessibilityLabel={`More options for ${item.display_name}'s post`}
          onPress={noop}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={24}
            color={colors.onSurfaceVariant}
          />
        </AccessiblePressable>
      </View>

      {/* ── Image + Badge ──────────────────────────── */}
      {photo && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: photo }} style={styles.postImage} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel(item.user_grade, item.type)}</Text>
          </View>
        </View>
      )}

      {/* ── Body ──────────────────────────────────── */}
      <View style={styles.body}>
        {/* Rating */}
        {item.rating !== null && <StarRating rating={item.rating} />}

        {/* Interaction bar */}
        <View style={styles.interactionBar}>
          <View style={styles.interactionLeft}>
            <AccessiblePressable
              accessibilityLabel="Like post"
              onPress={noop}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <MaterialCommunityIcons
                name="heart-outline"
                size={24}
                color={colors.onSurfaceVariant}
              />
            </AccessiblePressable>

            <AccessiblePressable
              accessibilityLabel="Comment on post"
              onPress={noop}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <MaterialCommunityIcons
                name="chat-outline"
                size={24}
                color={colors.onSurfaceVariant}
              />
            </AccessiblePressable>

            <AccessiblePressable
              accessibilityLabel="Share post"
              onPress={noop}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <MaterialCommunityIcons
                name="share-outline"
                size={24}
                color={colors.onSurfaceVariant}
              />
            </AccessiblePressable>
          </View>

          <AccessiblePressable
            accessibilityLabel="Bookmark post"
            onPress={noop}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <MaterialCommunityIcons
              name="bookmark-outline"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </AccessiblePressable>
        </View>

        {/* Notes */}
        {item.notes && (
          <Text style={styles.caption}>
            <Text style={styles.captionName}>{item.display_name}</Text>
            {'  '}
            {item.notes}
          </Text>
        )}

        {/* View all comments */}
        <AccessiblePressable accessibilityLabel="View all comments" onPress={noop}>
          <Text style={styles.viewComments}>VIEW ALL COMMENTS</Text>
        </AccessiblePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.7 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.bodyMd,
    fontFamily: 'Inter_700Bold',
    color: colors.onSurface,
  },
  userName: {
    ...typography.bodyMd,
    fontFamily: 'Inter_700Bold',
    color: colors.onSurface,
  },
  meta: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    letterSpacing: -0.3,
    marginTop: 2,
  },

  /* Image */
  imageContainer: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.surfaceContainerHigh,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(19,19,19,0.6)',
    borderRadius: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(168,200,255,0.2)',
  },
  badgeText: {
    fontFamily: 'Inter_900Black',
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.5,
  },

  /* Body */
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  interactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  interactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },

  caption: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  captionName: {
    fontFamily: 'Inter_700Bold',
  },

  viewComments: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(194,198,212,0.7)',
  },
});
