import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';

export interface AscentPostData {
  id: string;
  type: 'ascent';
  user: { name: string; avatar: string };
  gym: string;
  timeAgo: string;
  image: string;
  grade: string;
  ascentType: 'flash' | 'send' | 'attempt';
  likes: number;
  comments: number;
  liked: boolean;
  caption: string;
}

function badgeLabel(grade: string, ascentType: string): string {
  switch (ascentType) {
    case 'flash':
      return `${grade} FLASH ⚡`;
    case 'attempt':
      return `${grade} ATTEMPT`;
    default:
      return `NEW ${grade} SEND`;
  }
}

export function AscentPostCard({ item }: { item: AscentPostData }) {
  const [liked, setLiked] = useState(item.liked);
  const [likeCount, setLikeCount] = useState(item.likes);

  function handleLike() {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  }

  return (
    <View style={styles.card}>
      {/* ── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          <View>
            <Text style={styles.userName}>{item.user.name}</Text>
            <Text style={styles.meta}>
              {item.timeAgo} • {item.gym}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => console.log('Menu pressed')}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {/* ── Image + Badge ──────────────────────────── */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.postImage} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel(item.grade, item.ascentType)}</Text>
        </View>
      </View>

      {/* ── Interactions + Caption ──────────────────── */}
      <View style={styles.body}>
        {/* Interaction bar */}
        <View style={styles.interactionBar}>
          <View style={styles.interactionLeft}>
            <Pressable
              onPress={handleLike}
              style={({ pressed }) => [styles.interactionBtn, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name={liked ? 'heart' : 'heart-outline'}
                size={24}
                color={liked ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={styles.interactionCount}>{likeCount}</Text>
            </Pressable>

            <Pressable
              onPress={() => console.log('Comments pressed')}
              style={({ pressed }) => [styles.interactionBtn, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="chat-outline" size={24} color={colors.onSurfaceVariant} />
              <Text style={styles.interactionCount}>{item.comments}</Text>
            </Pressable>

            <Pressable
              onPress={() => console.log('Share pressed')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <MaterialCommunityIcons name="share-outline" size={24} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => console.log('Bookmark pressed')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <MaterialCommunityIcons name="bookmark-outline" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        {/* Caption */}
        <Text style={styles.caption}>
          <Text style={styles.captionName}>{item.user.name}</Text>
          {'  '}
          {item.caption}
        </Text>

        {/* View all comments */}
        <Pressable onPress={() => console.log('View comments pressed')}>
          <Text style={styles.viewComments}>VIEW ALL COMMENTS</Text>
        </Pressable>
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
  interactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  interactionCount: {
    ...typography.bodyMd,
    fontFamily: 'Inter_700Bold',
    color: colors.onSurface,
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
