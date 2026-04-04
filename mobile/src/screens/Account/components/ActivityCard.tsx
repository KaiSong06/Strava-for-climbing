import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export interface AscentActivity {
  id: string;
  colour: string;
  grade: string;
  gymName: string;
  imageUrl: string | null;
  ascentType: 'flash' | 'send' | 'attempt';
  createdAt: string;
}

interface Props {
  activity: AscentActivity;
  onPress?: () => void;
}

const BADGE_STYLES: Record<
  AscentActivity['ascentType'],
  { bg: string; color: string; label: string }
> = {
  flash: { bg: 'rgba(168,200,255,0.1)', color: colors.primary, label: 'FLASH ⚡' },
  send: { bg: 'rgba(255,182,145,0.1)', color: colors.tertiary, label: 'SEND' },
  attempt: { bg: 'rgba(255,180,171,0.1)', color: colors.error, label: 'ATTEMPT' },
};

export function ActivityCard({ activity, onPress }: Props) {
  const imageScale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(imageScale, {
      toValue: 1.05,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(imageScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  }

  const badge = BADGE_STYLES[activity.ascentType];

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.imageContainer}>
        {activity.imageUrl ? (
          <Animated.Image
            source={{ uri: activity.imageUrl }}
            style={[styles.image, { transform: [{ scale: imageScale }] }]}
          />
        ) : (
          <Animated.View
            style={[styles.imagePlaceholder, { transform: [{ scale: imageScale }] }]}
          />
        )}
        <View style={styles.gradeBadge}>
          <Text style={styles.gradeBadgeText}>{activity.grade}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.problemName}>
          {activity.colour} {activity.grade}
        </Text>
        <Text style={styles.gymName}>at {activity.gymName}</Text>
        <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(140, 145, 157, 0.05)',
  },
  cardPressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  imageContainer: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceContainerHighest,
  },
  gradeBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  gradeBadgeText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    padding: 24,
    gap: 6,
  },
  problemName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.onSurface,
  },
  gymName: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.onSurfaceVariant,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.0,
  },
});
