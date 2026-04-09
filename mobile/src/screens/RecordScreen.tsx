import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useVisionPipeline } from '@/src/hooks/useVisionPipeline';
import { useMatchResult } from '@/src/hooks/useMatchResult';
import { useAuthStore } from '@/src/stores/authStore';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 5;

const HOLD_COLOURS = [
  { label: 'Red', hex: '#ef4444' },
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Green', hex: '#22c55e' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Black', hex: '#1f2937' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'White', hex: '#f9fafb' },
  { label: 'Pink', hex: '#ec4899' },
];

const GRADES = [
  'VB',
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
];

const PROJECTS = [
  { id: 'p1', label: 'Main Project' },
  { id: 'p2', label: 'Summer Beta' },
  { id: 'p3', label: 'Moonboard Sessions' },
];

const PROCESSING_MESSAGES = ['Analysing holds…', 'Matching problem…', 'Almost there…'];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RecordScreen() {
  // Form state
  const [project, setProject] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);

  // Modal visibility
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [difficultyPickerVisible, setDifficultyPickerVisible] = useState(false);

  // New project creation
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [customProjects, setCustomProjects] = useState<{ id: string; label: string }[]>([]);

  // Processing message cycling
  const [processingMessage, setProcessingMessage] = useState(PROCESSING_MESSAGES[0]!);

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

  const {
    matchedProblemId,
    confidence,
    needsConfirmation,
    isAutoMatched,
    isUnmatched,
  } = useMatchResult(pipelineResult);

  const router = useRouter();

  const showOverlay = pipelineStatus === 'uploading' || pipelineStatus === 'processing';
  const showResult =
    pipelineStatus === 'matched' ||
    pipelineStatus === 'awaiting_confirmation' ||
    pipelineStatus === 'unmatched';

  // ── Processing animation ───────────────────────────────────────────────────

  const spinnerOpacity = useSharedValue(1);

  useEffect(() => {
    if (showOverlay) {
      spinnerOpacity.value = withRepeat(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(spinnerOpacity);
      spinnerOpacity.value = 1;
    }
  }, [showOverlay, spinnerOpacity]);

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
  }));

  // ── Processing message cycling ─────────────────────────────────────────────

  useEffect(() => {
    if (pipelineStatus !== 'processing') return;

    let i = 0;
    setProcessingMessage(PROCESSING_MESSAGES[0]!);

    const interval = setInterval(() => {
      i = (i + 1) % PROCESSING_MESSAGES.length;
      setProcessingMessage(PROCESSING_MESSAGES[i]!);
    }, 1000);

    return () => clearInterval(interval);
  }, [pipelineStatus]);

  // ── Error handling ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (pipelineStatus !== 'failed') return;
    Alert.alert('Upload failed', pipelineError ?? 'Something went wrong. Please try again.', [
      { text: 'Try Again', onPress: resetPipeline },
    ]);
  }, [pipelineStatus, pipelineError, resetPipeline]);

  // ── Confirmed success ──────────────────────────────────────────────────────

  useEffect(() => {
    if (pipelineStatus !== 'confirmed') return;
    // Reset form state after successful confirmation (navigation already happened in the handler)
    setProject(null);
    setPhotos([]);
    setHoldColor(null);
    setDifficulty(null);
    resetPipeline();
  }, [pipelineStatus, resetPipeline]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCapturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, { uri: result.assets[0]!.uri }].slice(0, MAX_PHOTOS));
    }
  }, []);

  const handleUploadFromLibrary = useCallback(async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled) {
      setPhotos((prev) =>
        [...prev, ...result.assets.map((a) => ({ uri: a.uri }))].slice(0, MAX_PHOTOS),
      );
    }
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

  const isPostEnabled = photos.length >= 1 && holdColor !== null && gymId !== null;

  // ── Render ────────────────────────────────────────────────────────────────

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
          {/* PROJECT */}
          <Text style={styles.sectionLabel}>Project</Text>
          <Pressable style={styles.pickerRow} onPress={() => setProjectPickerVisible(true)}>
            <Text style={[styles.pickerText, !project && styles.pickerPlaceholder]}>
              {project
                ? ([...PROJECTS, ...customProjects].find((p) => p.id === project)?.label ?? 'Unknown')
                : 'Select Project'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
          </Pressable>

          {/* MEDIA */}
          <View style={styles.mediaSectionGap} />
          {photos.length === 0 ? (
            <>
              <Pressable style={styles.actionCard} onPress={handleCapturePhoto}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(168,200,255,0.1)' }]}>
                  <MaterialCommunityIcons name="camera" size={28} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>Capture Photo</Text>
                <Text style={styles.cardSubtitle}>Open camera to take a photo</Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={handleUploadFromLibrary}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(178,199,240,0.1)' }]}>
                  <MaterialCommunityIcons name="cloud-upload" size={28} color={colors.secondary} />
                </View>
                <Text style={styles.cardTitle}>Upload from Library</Text>
                <Text style={styles.cardSubtitle}>Choose from your device gallery</Text>
              </Pressable>
            </>
          ) : (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoStrip}
              >
                {photos.map((photo, index) => (
                  <View key={photo.uri} style={styles.photoThumb}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photoThumbImage}
                      resizeMode="cover"
                    />
                    <Pressable
                      style={styles.photoRemoveButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <MaterialCommunityIcons name="close" size={14} color={colors.onSurface} />
                    </Pressable>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable style={styles.addPhotoButton} onPress={handleUploadFromLibrary}>
                    <MaterialCommunityIcons name="plus" size={24} color={colors.onSurfaceVariant} />
                  </Pressable>
                )}
              </ScrollView>
              <Text style={styles.photoCounter}>
                {photos.length}/{MAX_PHOTOS} photos
              </Text>
            </View>
          )}

          {/* HOLD COLOR */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Hold Color</Text>
          <Pressable style={styles.pickerRow} onPress={() => setColorPickerVisible(true)}>
            <View style={styles.pickerRowInner}>
              {holdColor && <View style={[styles.colorDot, { backgroundColor: holdColor }]} />}
              <Text style={[styles.pickerText, !holdColor && styles.pickerPlaceholder]}>
                {holdColor
                  ? (HOLD_COLOURS.find((c) => c.hex === holdColor)?.label ?? 'Unknown')
                  : 'Select Color'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
          </Pressable>

          {/* DIFFICULTY */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Difficulty</Text>
          <Pressable style={styles.pickerRow} onPress={() => setDifficultyPickerVisible(true)}>
            <Text style={[styles.pickerText, !difficulty && styles.pickerPlaceholder]}>
              {difficulty ?? 'Select Grade/V-Scale'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.onSurfaceVariant} />
          </Pressable>

          {/* POST */}
          <Pressable
            style={[styles.postButton, !isPostEnabled && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!isPostEnabled}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </Pressable>
          {!gymId && (
            <Text style={styles.noGymHint}>Set your home gym in Settings to log climbs</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Processing overlay */}
      {showOverlay && (
        <View style={styles.overlay}>
          <Animated.View style={spinnerStyle}>
            <ActivityIndicator size="large" color={colors.primary} />
          </Animated.View>
          <Text style={styles.processingText}>
            {pipelineStatus === 'uploading'
              ? `Uploading… ${Math.round(uploadProgress * 100)}%`
              : processingMessage}
          </Text>
        </View>
      )}

      {/* Match result overlay */}
      {showResult && (
        <View style={styles.overlay}>
          {isAutoMatched ? (
            <View style={styles.resultContent}>
              <MaterialCommunityIcons name="check-circle" size={56} color={colors.primary} />
              <Text style={styles.resultHeading}>Problem identified!</Text>
              {confidence !== null && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>{confidence}% match</Text>
                </View>
              )}
              <Pressable style={styles.resultButtonPrimary} onPress={handleConfirmMatch}>
                <Text style={styles.resultButtonPrimaryText}>Log Ascent</Text>
              </Pressable>
              <Pressable style={styles.resultButtonSecondary} onPress={handleNewProblem}>
                <Text style={styles.resultButtonSecondaryText}>Not my climb — new problem</Text>
              </Pressable>
            </View>
          ) : needsConfirmation ? (
            <View style={styles.resultContent}>
              <MaterialCommunityIcons
                name="help-circle-outline"
                size={56}
                color={colors.tertiary}
              />
              <Text style={styles.resultHeading}>Is this your climb?</Text>
              {confidence !== null && (
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>{confidence}% match</Text>
                </View>
              )}
              {matchedProblemId ? (
                <Pressable style={styles.resultButtonPrimary} onPress={handleConfirmMatch}>
                  <Text style={styles.resultButtonPrimaryText}>Yes, log it</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.resultButtonSecondary} onPress={handleNewProblem}>
                <Text style={styles.resultButtonSecondaryText}>No, it&apos;s a new problem</Text>
              </Pressable>
            </View>
          ) : isUnmatched ? (
            <View style={styles.resultContent}>
              <MaterialCommunityIcons name="plus-circle-outline" size={56} color={colors.primary} />
              <Text style={styles.resultHeading}>New problem detected</Text>
              <Text style={styles.resultSubtext}>
                No matching problem found. Create it as a new problem to start tracking ascents.
              </Text>
              {holdColor && (
                <View style={styles.newProblemDetail}>
                  <View style={[styles.colorDot, { backgroundColor: holdColor }]} />
                  <Text style={styles.newProblemDetailText}>
                    {HOLD_COLOURS.find((c) => c.hex === holdColor)?.label ?? 'Unknown'} holds
                  </Text>
                </View>
              )}
              {difficulty && (
                <View style={styles.newProblemDetail}>
                  <MaterialCommunityIcons name="trending-up" size={16} color={colors.onSurfaceVariant} />
                  <Text style={styles.newProblemDetailText}>{difficulty}</Text>
                </View>
              )}
              <Pressable style={styles.resultButtonPrimary} onPress={handleNewProblem}>
                <Text style={styles.resultButtonPrimaryText}>Create New Problem</Text>
              </Pressable>
              <Pressable style={styles.resultButtonSecondary} onPress={resetPipeline}>
                <Text style={styles.resultButtonSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {/* Project picker modal */}
      <Modal
        visible={projectPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCreatingProject(false);
          setNewProjectName('');
          setProjectPickerVisible(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setCreatingProject(false);
            setNewProjectName('');
            setProjectPickerVisible(false);
          }}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
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
                  onSubmitEditing={() => {
                    const trimmed = newProjectName.trim();
                    if (!trimmed) return;
                    const id = `custom-${Date.now()}`;
                    setCustomProjects((prev) => [...prev, { id, label: trimmed }]);
                    setProject(id);
                    setNewProjectName('');
                    setCreatingProject(false);
                    setProjectPickerVisible(false);
                  }}
                />
                <Pressable
                  style={[
                    styles.newProjectSaveButton,
                    !newProjectName.trim() && styles.postButtonDisabled,
                  ]}
                  onPress={() => {
                    const trimmed = newProjectName.trim();
                    if (!trimmed) return;
                    const id = `custom-${Date.now()}`;
                    setCustomProjects((prev) => [...prev, { id, label: trimmed }]);
                    setProject(id);
                    setNewProjectName('');
                    setCreatingProject(false);
                    setProjectPickerVisible(false);
                  }}
                >
                  <Text style={styles.newProjectSaveText}>Save</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.modalRow}
                onPress={() => setCreatingProject(true)}
              >
                <Text style={[styles.modalRowText, styles.modalRowCreate]}>
                  + Create New Project
                </Text>
              </Pressable>
            )}

            {[...PROJECTS, ...customProjects].map((p) => (
              <Pressable
                key={p.id}
                style={styles.modalRow}
                onPress={() => {
                  setProject(p.id);
                  setProjectPickerVisible(false);
                }}
              >
                <Text style={[styles.modalRowText, project === p.id && styles.modalRowActiveText]}>
                  {p.label}
                </Text>
                {project === p.id && (
                  <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hold color picker modal */}
      <Modal
        visible={colorPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setColorPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setColorPickerVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Hold Color</Text>

            {HOLD_COLOURS.map((color) => (
              <Pressable
                key={color.hex}
                style={styles.modalRow}
                onPress={() => {
                  setHoldColor(color.hex);
                  setColorPickerVisible(false);
                }}
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
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Difficulty picker modal */}
      <Modal
        visible={difficultyPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDifficultyPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDifficultyPickerVisible(false)}>
          <Pressable style={[styles.modalSheet, styles.modalSheetTall]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Difficulty</Text>
            <FlatList
              data={GRADES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    setDifficulty(item);
                    setDifficultyPickerVisible(false);
                  }}
                >
                  <Text
                    style={[styles.modalRowText, difficulty === item && styles.modalRowActiveText]}
                  >
                    {item}
                  </Text>
                  {difficulty === item && (
                    <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  // Section labels
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

  // Picker rows
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

  // Color dot
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Media section
  mediaSectionGap: { height: spacing.xl },

  actionCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.10)',
    gap: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  // Photo strip (multi-photo)
  photoStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(14,14,14,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
  },
  photoCounter: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },

  // POST button
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
  noGymHint: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Processing overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,14,14,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  processingText: {
    color: colors.onSurface,
    fontSize: 16,
    marginTop: 20,
  },

  // Match result overlay content
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  resultHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  confidenceBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  resultButtonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  resultButtonPrimaryText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resultButtonSecondary: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resultSubtext: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  newProblemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newProblemDetailText: {
    fontSize: 14,
    color: colors.onSurface,
  },
  resultButtonSecondaryText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },

  // Picker modals
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
  modalRowCreate: {
    color: colors.primary,
    fontWeight: '700',
  },

  // New project creation
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
});
