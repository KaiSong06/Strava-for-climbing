import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

export interface ListSkeletonProps {
  count?: number;
}

const SHIMMER_DURATION_MS = 900;
const SHIMMER_MIN = 0.3;
const SHIMMER_MAX = 0.6;
const AVATAR_SIZE = 44;
const LINE_HEIGHT_TALL = 12;
const LINE_HEIGHT_SHORT = 10;
const IMAGE_HEIGHT = 180;

/**
 * Shimmering placeholder loader for feed / list screens.
 * Loops opacity only — no layout animations, no hardcoded colors.
 */
export function ListSkeleton({ count = 3 }: ListSkeletonProps) {
  const opacity = useRef(new Animated.Value(SHIMMER_MIN)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: SHIMMER_MAX,
          duration: SHIMMER_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: SHIMMER_MIN,
          duration: SHIMMER_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View
      style={styles.container}
      accessibilityLabel="Loading..."
      importantForAccessibility="yes"
    >
      {items.map((i) => (
        <View key={i} style={styles.item}>
          <View style={styles.headerRow}>
            <Animated.View style={[styles.avatar, { opacity }]} />
            <View style={styles.textColumn}>
              <Animated.View style={[styles.lineTall, { opacity }]} />
              <Animated.View style={[styles.lineShort, { opacity }]} />
            </View>
          </View>
          <Animated.View style={[styles.image, { opacity }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  item: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceContainerHigh,
  },
  textColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  lineTall: {
    height: LINE_HEIGHT_TALL,
    width: '60%',
    borderRadius: spacing.xs,
    backgroundColor: colors.surfaceContainerHigh,
  },
  lineShort: {
    height: LINE_HEIGHT_SHORT,
    width: '40%',
    borderRadius: spacing.xs,
    backgroundColor: colors.surfaceContainer,
  },
  image: {
    height: IMAGE_HEIGHT,
    borderRadius: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
});
