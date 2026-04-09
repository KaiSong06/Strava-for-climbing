import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import type { Gym } from '@shared/types';

interface Props {
  gym: Gym;
  onPress: (gym: Gym) => void;
  distance_km?: number;
}

export function GymCard({ gym, onPress, distance_km }: Props) {
  const distanceLabel =
    distance_km != null ? `, ${Number(distance_km).toFixed(1)} kilometres away` : '';
  const accessibilityLabel = `${gym.name}, ${gym.city}${distanceLabel}`;

  return (
    <AccessiblePressable
      onPress={() => onPress(gym)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.gymName}>{gym.name}</Text>
          <Text style={styles.gymMeta}>
            {gym.city}
            {distance_km != null ? ` \u2022 ${Number(distance_km).toFixed(1)} km` : ''}
          </Text>
        </View>
        <View style={styles.navButton}>
          <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onPrimary} />
        </View>
      </View>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 20,
    padding: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginRight: spacing.md,
  },
  gymName: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textTransform: 'uppercase',
    fontStyle: 'italic',
  },
  gymMeta: {
    ...typography.bodyMd,
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
