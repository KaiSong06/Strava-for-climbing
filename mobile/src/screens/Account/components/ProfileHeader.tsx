import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AuthUser } from '@shared/types';
import { colors } from '@/src/theme/colors';

interface Props {
  profile: AuthUser;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
}

export function ProfileHeader({ profile, onFollowersPress, onFollowingPress }: Props) {
  return (
    <View style={styles.container}>
      {/* Avatar with glow ring */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarGlow} />
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {profile.display_name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Display name */}
      <Text style={styles.displayName}>{profile.display_name}</Text>

      {/* Username handle */}
      <Text style={styles.username}>@{profile.username}</Text>

      {/* Home gym */}
      {profile.home_gym_name != null && (
        <View style={styles.gymRow}>
          <MaterialCommunityIcons name="map-marker" size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.gymText}>{profile.home_gym_name.toUpperCase()}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <Pressable style={styles.stat} onPress={onFollowersPress} hitSlop={8}>
          <Text style={styles.statCount}>{formatCount(profile.follower_count)}</Text>
          <Text style={styles.statLabel}>FOLLOWERS</Text>
        </Pressable>
        <Pressable style={styles.stat} onPress={onFollowingPress} hitSlop={8}>
          <Text style={styles.statCount}>{formatCount(profile.following_count)}</Text>
          <Text style={styles.statLabel}>FOLLOWING</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    // Extra space so the glow shadow isn't clipped
    padding: 12,
  },
  // Blurred glow ring behind the avatar: primary color at low opacity +
  // a shadow to simulate the gradient blur from the HTML reference.
  avatarGlow: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: 'rgba(168, 200, 255, 0.12)',
    shadowColor: '#a8c8ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 16,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.surfaceContainer,
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryContainer,
    borderWidth: 4,
    borderColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.primary,
    fontSize: 52,
    fontWeight: '700',
  },

  // ── Identity ──────────────────────────────────────────────────────────────
  displayName: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.onSurface,
    letterSpacing: -0.6, // -0.02 × 30
    textAlign: 'center',
    marginTop: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
    textAlign: 'center',
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  gymText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.2, // 0.1 × 12
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.0,
    marginTop: 2,
    textAlign: 'center',
  },
});
