import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

interface PickerRowProps {
  /** Current selection as a display label, or null when unset. */
  value: string | null;
  /** Shown when value is null. */
  placeholder: string;
  /** Accessibility label when a value is selected. */
  accessibilityLabelSelected: string;
  /** Accessibility label when no value is selected. */
  accessibilityLabelEmpty: string;
  /** Optional visual adornment rendered inside the row before the label (e.g. color dot). */
  leadingAdornment?: React.ReactNode;
  onPress: () => void;
}

/**
 * Reusable picker trigger row used by Project / Hold Color / Difficulty sections.
 *
 * Keeps RecordScreen thin and ensures the three picker rows stay visually consistent
 * without duplicating the style block.
 */
export function PickerRow({
  value,
  placeholder,
  accessibilityLabelSelected,
  accessibilityLabelEmpty,
  leadingAdornment,
  onPress,
}: PickerRowProps) {
  return (
    <AccessiblePressable
      style={styles.pickerRow}
      onPress={onPress}
      accessibilityLabel={value ? accessibilityLabelSelected : accessibilityLabelEmpty}
      accessibilityRole="button"
    >
      <View style={styles.pickerRowInner}>
        {leadingAdornment}
        <Text style={[styles.pickerText, !value && styles.pickerPlaceholder]}>
          {value ?? placeholder}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  pickerRow: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.15)',
  },
  pickerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  pickerPlaceholder: {
    color: colors.onSurfaceVariant,
  },
});
