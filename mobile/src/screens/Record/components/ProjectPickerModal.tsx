import { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { PROJECTS, type Project } from '../constants';

interface ProjectPickerModalProps {
  visible: boolean;
  project: string | null;
  customProjects: Project[];
  onSelect: (id: string) => void;
  onCreateProject: (label: string) => string | null;
  onClose: () => void;
}

export function ProjectPickerModal({
  visible,
  project,
  customProjects,
  onSelect,
  onCreateProject,
  onClose,
}: ProjectPickerModalProps) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const resetLocal = useCallback(() => {
    setCreatingProject(false);
    setNewProjectName('');
  }, []);

  const handleClose = useCallback(() => {
    resetLocal();
    onClose();
  }, [resetLocal, onClose]);

  const handleSaveNewProject = useCallback(() => {
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    onCreateProject(trimmed);
    resetLocal();
    onClose();
  }, [newProjectName, onCreateProject, resetLocal, onClose]);

  const handleSelect = useCallback(
    (id: string) => {
      // Matches original RecordScreen behaviour: selecting an existing project just sets
      // the value and closes the modal. It does not reset `creatingProject`/`newProjectName`.
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <AccessiblePressable
        style={styles.modalBackdrop}
        onPress={handleClose}
        accessibilityLabel="Close project picker"
        accessibilityRole="button"
      >
        <AccessiblePressable
          style={styles.modalSheet}
          onPress={() => {}}
          accessibilityLabel="Project picker"
          accessibilityRole="none"
        >
          <Text style={styles.modalTitle}>Project</Text>

          {creatingProject ? (
            <View style={styles.newProjectRow}>
              <TextInput
                style={styles.newProjectInput}
                placeholder="Project name"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newProjectName}
                onChangeText={setNewProjectName}
                autoFocus
                returnKeyType="done"
                selectionColor={colors.primary}
                accessibilityLabel="New project name"
                onSubmitEditing={handleSaveNewProject}
              />
              <AccessiblePressable
                style={[
                  styles.newProjectSaveButton,
                  !newProjectName.trim() && styles.postButtonDisabled,
                ]}
                onPress={handleSaveNewProject}
                accessibilityLabel="Save new project"
                accessibilityRole="button"
                accessibilityState={{ disabled: !newProjectName.trim() }}
              >
                <Text style={styles.newProjectSaveText}>Save</Text>
              </AccessiblePressable>
            </View>
          ) : (
            <AccessiblePressable
              style={styles.modalRow}
              onPress={() => setCreatingProject(true)}
              accessibilityLabel="Create new project"
              accessibilityRole="button"
            >
              <Text style={[styles.modalRowText, styles.modalRowCreate]}>
                + Create New Project
              </Text>
            </AccessiblePressable>
          )}

          {[...PROJECTS, ...customProjects].map((p) => (
            <AccessiblePressable
              key={p.id}
              style={styles.modalRow}
              onPress={() => handleSelect(p.id)}
              accessibilityLabel={`Select project ${p.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: project === p.id }}
            >
              <Text style={[styles.modalRowText, project === p.id && styles.modalRowActiveText]}>
                {p.label}
              </Text>
              {project === p.id && (
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
  modalRowText: {
    fontSize: 16,
    color: colors.onSurface,
  },
  modalRowActiveText: {
    color: colors.primary,
  },
  modalRowCreate: {
    color: colors.primary,
    fontWeight: '700',
  },
  newProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  newProjectInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 8,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.onSurface,
  },
  newProjectSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  newProjectSaveText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
});
