import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import type { FriendEntry } from '../searchTypes';

interface FriendsRowProps {
  friends: FriendEntry[];
  onFriendPress?: (friend: FriendEntry) => void;
}

function AvatarWithRing({ friend }: { friend: FriendEntry }) {
  if (friend.hasNewActivity) {
    return (
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.avatarRing}
      >
        <View style={styles.avatarInner}>
          <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.avatarRing, styles.avatarRingInactive]}>
      <View style={styles.avatarInner}>
        <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
      </View>
    </View>
  );
}

export function FriendsRow({ friends, onFriendPress }: FriendsRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Pressable onPress={() => setExpanded((prev) => !prev)} hitSlop={8}>
          <Text style={styles.viewAll}>{expanded ? 'Show less' : 'View all'}</Text>
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.listContent}>
          {friends.map((friend) => (
            <Pressable
              key={friend.id}
              style={styles.listItem}
              onPress={() => onFriendPress?.(friend)}
            >
              <AvatarWithRing friend={friend} />
              <Text style={styles.listUsername} numberOfLines={1}>
                {friend.username}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {friends.map((friend) => (
            <Pressable
              key={friend.id}
              style={styles.friendItem}
              onPress={() => onFriendPress?.(friend)}
            >
              <AvatarWithRing friend={friend} />
              <Text style={styles.username} numberOfLines={1}>
                {friend.username}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const AVATAR_SIZE = 64;
const RING_SIZE = AVATAR_SIZE + 4; // 2px padding on each side

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.onSurface,
  },
  viewAll: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.primary,
  },
  scrollContent: {
    paddingRight: spacing.lg,
    gap: spacing.lg,
  },
  friendItem: {
    alignItems: 'center',
    gap: spacing.sm,
    width: RING_SIZE + spacing.sm,
  },
  avatarRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    padding: 2,
  },
  avatarRingInactive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatarInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  username: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    color: colors.onSurfaceVariant,
  },
  listContent: {
    gap: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  listUsername: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: colors.onSurface,
  },
});
