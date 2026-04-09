import { FlatList, Modal, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { GRADES } from '../constants';

interface DifficultyPickerModalProps {
  visible: boolean;
  difficulty: string | null;
  onSelect: (grade: string) => void;
  onClose: () => void;
}

export function DifficultyPickerModal({
  visible,
  difficulty,
  onSelect,
  onClose,
}: DifficultyPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <AccessiblePressable
        style={styles.modalBackdrop}
        onPress={onClose}
        accessibilityLabel="Close difficulty picker"
        accessibilityRole="button"
      >
        <AccessiblePressable
          style={[styles.modalSheet, styles.modalSheetTall]}
          onPress={() => {}}
          accessibilityLabel="Difficulty picker"
          accessibilityRole="none"
        >
          <Text style={styles.modalTitle}>Difficulty</Text>
          <FlatList
            data={GRADES as string[]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <AccessiblePressable
                style={styles.modalRow}
                onPress={() => onSelect(item)}
                accessibilityLabel={`Select grade ${item}`}
                accessibilityRole="button"
                accessibilityState={{ selected: difficulty === item }}
              >
                <Text
                  style={[styles.modalRowText, difficulty === item && styles.modalRowActiveText]}
                >
                  {item}
                </Text>
                {difficulty === item && (
                  <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                )}
              </AccessiblePressable>
            )}
          />
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
  modalSheetTall: {
    maxHeight: '70%',
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
  modalRowText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  modalRowActiveText: {
    color: colors.primary,
  },
});
