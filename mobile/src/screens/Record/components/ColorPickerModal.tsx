import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { HOLD_COLOURS } from '../constants';

interface ColorPickerModalProps {
  visible: boolean;
  holdColor: string | null;
  onSelect: (hex: string) => void;
  onClose: () => void;
}

export function ColorPickerModal({
  visible,
  holdColor,
  onSelect,
  onClose,
}: ColorPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <AccessiblePressable
        style={styles.modalBackdrop}
        onPress={onClose}
        accessibilityLabel="Close hold color picker"
        accessibilityRole="button"
      >
        <AccessiblePressable
          style={styles.modalSheet}
          onPress={() => {}}
          accessibilityLabel="Hold color picker"
          accessibilityRole="none"
        >
          <Text style={styles.modalTitle}>Hold Color</Text>

          {HOLD_COLOURS.map((color) => (
            <AccessiblePressable
              key={color.hex}
              style={styles.modalRow}
              onPress={() => onSelect(color.hex)}
              accessibilityLabel={`Select ${color.label} hold color`}
              accessibilityRole="button"
              accessibilityState={{ selected: holdColor === color.hex }}
            >
              <View style={styles.modalRowLeft}>
                <View style={[styles.colorDot, { backgroundColor: color.hex }]} />
                <Text
                  style={[
                    styles.modalRowText,
                    holdColor === color.hex && styles.modalRowActiveText,
                  ]}
                >
                  {color.label}
                </Text>
              </View>
              {holdColor === color.hex && (
                <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
              )}
            </AccessiblePressable>
          ))}
        </AccessiblePressable>
      </AccessiblePressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  modalRow: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modalRowText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  modalRowActiveText: {
    color: colors.primary,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
