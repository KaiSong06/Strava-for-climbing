import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useVisionPipeline } from '@/src/hooks/useVisionPipeline';
import { useMatchResult } from '@/src/hooks/useMatchResult';
import { useAuthStore } from '@/src/stores/authStore';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { HOLD_COLOURS, PROJECTS } from './constants';
import { useRecordForm } from './hooks/useRecordForm';
import { useRecordCamera } from './hooks/useRecordCamera';
import { PhotoStagingArea } from './components/PhotoStagingArea';
import { PickerRow } from './components/PickerRow';
import { PostButton } from './components/PostButton';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { MatchResultOverlay } from './components/MatchResultOverlay';
import { ProjectPickerModal } from './components/ProjectPickerModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { DifficultyPickerModal } from './components/DifficultyPickerModal';

export default function RecordScreen() {
  const {
    project,
    setProject,
    photos,
    addPhotos,
    removePhoto,
    holdColor,
    setHoldColor,
    difficulty,
    setDifficulty,
    customProjects,
    addCustomProject,
    resetForm,
    isPostEnabled: isPostEnabledFn,
  } = useRecordForm();

  const { capturePhoto, uploadFromLibrary } = useRecordCamera({
    photosLength: photos.length,
    addPhotos,
  });

  // Modal visibility
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [difficultyPickerVisible, setDifficultyPickerVisible] = useState(false);

  // Auth — gym_id from the user's home gym
  const gymId = useAuthStore((s) => s.user?.home_gym_id ?? null);

  // Pipeline hooks
  const {
    status: pipelineStatus,
    uploadProgress,
    result: pipelineResult,
    error: pipelineError,
    submit: submitPipeline,
    confirm: confirmPipeline,
    reset: resetPipeline,
  } = useVisionPipeline();

  const { matchedProblemId, confidence, needsConfirmation, isAutoMatched, isUnmatched } =
    useMatchResult(pipelineResult);

  const router = useRouter();

  // Reset Alert on upload failure
  useEffect(() => {
    if (pipelineStatus !== 'failed') return;
    Alert.alert('Upload failed', pipelineError ?? 'Something went wrong. Please try again.', [
      { text: 'Try Again', onPress: resetPipeline },
    ]);
  }, [pipelineStatus, pipelineError, resetPipeline]);

  // Reset form after confirmation (navigation already happened in the handler)
  useEffect(() => {
    if (pipelineStatus !== 'confirmed') return;
    resetForm();
    resetPipeline();
  }, [pipelineStatus, resetForm, resetPipeline]);

  const handlePost = useCallback(() => {
    if (photos.length < 1 || !holdColor || !gymId) return;
    void submitPipeline(photos, holdColor, gymId);
  }, [photos, holdColor, gymId, submitPipeline]);

  const handleConfirmMatch = useCallback(async () => {
    if (!matchedProblemId) return;
    try {
      const res = await confirmPipeline({
        problemId: matchedProblemId,
        user_grade: difficulty,
        rating: null,
        notes: null,
        visibility: 'public',
      });
      router.push({ pathname: '/problem/[id]', params: { id: res.problemId } });
    } catch {
      // error state is set by the hook
    }
  }, [matchedProblemId, difficulty, confirmPipeline, router]);

  const handleNewProblem = useCallback(async () => {
    try {
      const res = await confirmPipeline({
        problemId: 'new',
        user_grade: difficulty,
        rating: null,
        notes: null,
        visibility: 'public',
      });
      router.push({ pathname: '/problem/[id]', params: { id: res.problemId } });
    } catch {
      // error state is set by the hook
    }
  }, [difficulty, confirmPipeline, router]);

  const isPostEnabled = isPostEnabledFn(gymId);

  // Derived picker display labels
  const projectLabel = project
    ? ([...PROJECTS, ...customProjects].find((p) => p.id === project)?.label ?? 'Unknown')
    : null;
  const holdColorLabel = holdColor
    ? (HOLD_COLOURS.find((c) => c.hex === holdColor)?.label ?? 'Unknown')
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Project</Text>
          <PickerRow
            value={projectLabel}
            placeholder="Select Project"
            accessibilityLabelSelected={`Project: ${projectLabel ?? ''}. Tap to change.`}
            accessibilityLabelEmpty="Select a project"
            onPress={() => setProjectPickerVisible(true)}
          />

          <View style={styles.mediaSectionGap} />
          <PhotoStagingArea
            photos={photos}
            onCapturePhoto={capturePhoto}
            onUploadFromLibrary={uploadFromLibrary}
            onRemovePhoto={removePhoto}
          />

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Hold Color</Text>
          <PickerRow
            value={holdColorLabel}
            placeholder="Select Color"
            accessibilityLabelSelected={`Hold color: ${holdColorLabel ?? ''}. Tap to change.`}
            accessibilityLabelEmpty="Select hold color"
            leadingAdornment={
              holdColor ? <View style={[styles.colorDot, { backgroundColor: holdColor }]} /> : null
            }
            onPress={() => setColorPickerVisible(true)}
          />

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Difficulty</Text>
          <PickerRow
            value={difficulty}
            placeholder="Select Grade/V-Scale"
            accessibilityLabelSelected={`Difficulty: ${difficulty ?? ''}. Tap to change.`}
            accessibilityLabelEmpty="Select difficulty grade"
            onPress={() => setDifficultyPickerVisible(true)}
          />

          <PostButton enabled={isPostEnabled} onPress={handlePost} />
          {!gymId && (
            <Text style={styles.noGymHint}>Set your home gym in Settings to log climbs</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ProcessingOverlay status={pipelineStatus} uploadProgress={uploadProgress} />

      <MatchResultOverlay
        status={pipelineStatus}
        isAutoMatched={isAutoMatched}
        needsConfirmation={needsConfirmation}
        isUnmatched={isUnmatched}
        confidence={confidence}
        matchedProblemId={matchedProblemId}
        holdColor={holdColor}
        difficulty={difficulty}
        onConfirmMatch={handleConfirmMatch}
        onNewProblem={handleNewProblem}
        onCancel={resetPipeline}
      />

      <ProjectPickerModal
        visible={projectPickerVisible}
        project={project}
        customProjects={customProjects}
        onSelect={setProject}
        onCreateProject={addCustomProject}
        onClose={() => setProjectPickerVisible(false)}
      />

      <ColorPickerModal
        visible={colorPickerVisible}
        holdColor={holdColor}
        onSelect={(hex) => {
          setHoldColor(hex);
          setColorPickerVisible(false);
        }}
        onClose={() => setColorPickerVisible(false)}
      />

      <DifficultyPickerModal
        visible={difficultyPickerVisible}
        difficulty={difficulty}
        onSelect={(grade) => {
          setDifficulty(grade);
          setDifficultyPickerVisible(false);
        }}
        onClose={() => setDifficultyPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  sectionLabelSpaced: {
    marginTop: spacing.xl,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mediaSectionGap: { height: spacing.xl },
  noGymHint: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
