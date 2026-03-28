import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import type { FriendEntry } from '../mockSearchData';

interface FriendsRowProps {
  friends: FriendEntry[];
  onViewAll?: () => void;
  onFriendPress?: (friend: FriendEntry) => void;
}

export function FriendsRow({ friends, onViewAll, onFriendPress }: FriendsRowProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>View all</Text>
        </Pressable>
      </View>

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
            {friend.hasNewActivity ? (
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
            ) : (
              <View style={[styles.avatarRing, styles.avatarRingInactive]}>
                <View style={styles.avatarInner}>
                  <Image source={{ uri: friend.avatarUrl }} style={styles.avatar} />
                </View>
              </View>
            )}
            <Text style={styles.username} numberOfLines={1}>
              {friend.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
});
