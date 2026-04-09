import { StyleSheet, Text } from 'react-native';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

interface PostButtonProps {
  enabled: boolean;
  onPress: () => void;
}

export function PostButton({ enabled, onPress }: PostButtonProps) {
  return (
    <AccessiblePressable
      style={[styles.postButton, !enabled && styles.postButtonDisabled]}
      onPress={onPress}
      disabled={!enabled}
      accessibilityLabel="Post climb"
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.postButtonText}>Post</Text>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  postButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: spacing.xxxl,
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
});
