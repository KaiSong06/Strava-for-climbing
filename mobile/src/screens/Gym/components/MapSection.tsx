import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

// Vertical grid line positions (%) to suggest map street tiles
const V_LINES = ['13%', '25%', '38%', '50%', '63%', '75%', '88%'] as const;
// Horizontal grid line positions (%)
const H_LINES = ['18%', '36%', '55%', '73%'] as const;

export function MapSection() {
  const pulseScale = useRef(new Animated.Value(0.4)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 2.2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 0.4,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseScale, pulseOpacity]);

  return (
    <View style={styles.container}>
      {/* Dark navy map placeholder — replace this View with <MapView> from
          react-native-maps (and expo-location for user position) once installed. */}
      <View style={styles.mapBg} />

      {/* Subtle grid lines to suggest street tiles */}
      {V_LINES.map((left) => (
        <View key={left} style={[styles.gridLineV, { left }]} />
      ))}
      {H_LINES.map((top) => (
        <View key={top} style={[styles.gridLineH, { top }]} />
      ))}

      {/* Bottom gradient: transparent → black/60% for search bar blend */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* User location pin — centred, above the search bar area */}
      <View style={styles.pinCenter} pointerEvents="none">
        {/* pinStack stacks the glow ring behind the pin circle using absoluteFill */}
        <View style={styles.pinStack}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
          <View style={styles.pinOuter}>
            <View style={styles.pinDot} />
          </View>
        </View>
      </View>

      {/* Frosted-glass search bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={`${colors.onSurface}80`}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Find a gym near you..."
            placeholderTextColor={`${colors.onSurfaceVariant}b3`}
            returnKeyType="search"
            selectionColor={colors.primary}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 340,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#141a24',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(168,200,255,0.05)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(168,200,255,0.05)',
  },
  // Full-cover overlay that centres the pin, with bottom room for the search bar
  pinCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 72, // clear the search bar height
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 96×96 fixed-size container that stacks the ring behind the pin using absoluteFill
  pinStack: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: 'rgba(168,200,255,0.2)',
  },
  pinOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.onSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  searchWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32,31,31,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurface,
    padding: 0,
  },
});
