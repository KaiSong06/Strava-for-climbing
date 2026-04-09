import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { AccessiblePressable } from './AccessiblePressable';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ICON_SIZE = 48;

/**
 * Reusable empty-error state for list/detail screens. Centered vertically
 * within its container; shows an icon, a message, and an optional retry button.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={ICON_SIZE}
        color={colors.error}
      />
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <AccessiblePressable
          onPress={onRetry}
          accessibilityLabel="Retry"
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </AccessiblePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.xl,
    backgroundColor: colors.surfaceContainerHigh,
  },
  retryButtonPressed: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  retryLabel: {
    ...typography.labelMd,
    color: colors.primary,
  },
});
