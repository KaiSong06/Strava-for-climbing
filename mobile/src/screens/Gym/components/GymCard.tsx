import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { RecentClimbsRow } from './RecentClimbsRow';
import type { Gym } from '../mockGyms';

type TierConfig = { bg: string; text: string; border: string };

const TIER_CONFIG: Record<Gym['tier'], TierConfig> = {
  'PRO LEVEL': {
    bg: 'rgba(168,200,255,0.2)',
    text: colors.primary,
    border: 'rgba(168,200,255,0.2)',
  },
  CLASSIC: {
    bg: 'rgba(178,199,240,0.2)',
    text: colors.secondary,
    border: 'rgba(178,199,240,0.2)',
  },
  ELITE: {
    bg: 'rgba(255,182,145,0.2)',
    text: colors.tertiary,
    border: 'rgba(255,182,145,0.2)',
  },
};

interface Props {
  gym: Gym;
  onPress: (gym: Gym) => void;
}

export function GymCard({ gym, onPress }: Props) {
  const imageScale = useRef(new Animated.Value(1)).current;
  const tier = TIER_CONFIG[gym.tier];

  function handlePressIn() {
    Animated.timing(imageScale, {
      toValue: 1.04,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    Animated.timing(imageScale, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  return (
    <View>
      {/* Image area */}
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(gym)}
        style={styles.imageContainer}
      >
        <Animated.Image
          source={{ uri: gym.imageUrl }}
          style={[styles.image, { transform: [{ scale: imageScale }] }]}
        />

        {/* Tier badge — top-left */}
        <View
          style={[
            styles.tierBadge,
            { backgroundColor: tier.bg, borderColor: tier.border },
          ]}
        >
          <Text style={[styles.tierText, { color: tier.text }]}>{gym.tier}</Text>
        </View>

        {/* Active count pill — bottom-right */}
        <View style={styles.activePill}>
          <PulseDot />
          <Text style={styles.activeText}>{gym.activeCount} ACTIVE</Text>
        </View>
      </Pressable>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.gymName}>{gym.name}</Text>
          <Text style={styles.gymMeta}>
            {gym.distance} • {gym.hours}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.75 }]}
          onPress={() => onPress(gym)}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>

      {/* Recent climbs */}
      <RecentClimbsRow climbs={gym.recentClimbs} />
    </View>
  );
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[styles.activeDot, { opacity }]} />;
}

const styles = StyleSheet.create({
  imageContainer: {
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    opacity: 0.85,
  },
  tierBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierText: {
    fontFamily: 'Inter_900Black',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activePill: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(19,19,19,0.6)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981', // emerald-500
  },
  activeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.onSurface,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginRight: spacing.md,
  },
  gymName: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    letterSpacing: -0.5,
    lineHeight: 26,
    color: colors.onSurface,
    textTransform: 'uppercase',
    fontStyle: 'italic',
  },
  gymMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
