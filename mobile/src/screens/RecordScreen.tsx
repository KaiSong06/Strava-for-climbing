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
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
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

// ── Constants ─────────────────────────────────────────────────────────────────

const HOLD_COLOURS = [
  { label: 'Red',    hex: '#ef4444' },
  { label: 'Blue',   hex: '#3b82f6' },
  { label: 'Green',  hex: '#22c55e' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Black',  hex: '#1f2937' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'White',  hex: '#f9fafb' },
  { label: 'Pink',   hex: '#ec4899' },
];

const GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8',
  'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
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
  const [project, setProject]   = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [holdColor, setHoldColor]   = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);

  // Modal visibility
  const [projectPickerVisible,    setProjectPickerVisible]    = useState(false);
  const [colorPickerVisible,      setColorPickerVisible]      = useState(false);
  const [difficultyPickerVisible, setDifficultyPickerVisible] = useState(false);

  // Processing overlay
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(PROCESSING_MESSAGES[0]!);

  // Hooks (wired in Phase 4b)
  const { submit: submitVision, status: visionStatus, result: visionResult } = useVisionPipeline();
  const { matchedProblem, confidence, needsConfirmation } = useMatchResult();

  // Stub references — consumed by Phase 4b wiring
  useEffect(() => {
    // Phase 4b: react to vision pipeline status changes
  }, [visionStatus, visionResult]);

  useEffect(() => {
    // Phase 4b: handle match confirmation flow
  }, [matchedProblem, confidence, needsConfirmation]);

  // ── Processing animation ───────────────────────────────────────────────────

  const spinnerOpacity = useSharedValue(1);

  useEffect(() => {
    if (isProcessing) {
      spinnerOpacity.value = withRepeat(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(spinnerOpacity);
      spinnerOpacity.value = 1;
    }
  }, [isProcessing, spinnerOpacity]);

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
  }));

  // ── Processing message cycling + auto-dismiss ──────────────────────────────

  useEffect(() => {
    if (!isProcessing) return;

    let i = 0;
    setProcessingMessage(PROCESSING_MESSAGES[0]!);

    const interval = setInterval(() => {
      i = (i + 1) % PROCESSING_MESSAGES.length;
      setProcessingMessage(PROCESSING_MESSAGES[i]!);
    }, 1000);

    const dismiss = setTimeout(() => {
      clearInterval(interval);
      setIsProcessing(false);
      Alert.alert('Climb logged!', 'Your climb has been analysed.', [{ text: 'OK' }]);
      setProject(null);
      setMediaUri(null);
      setHoldColor(null);
      setDifficulty(null);
    }, 2500);

    return () => {
      clearInterval(interval);
      clearTimeout(dismiss);
    };
  }, [isProcessing]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCapturePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
    }
  }, []);

  const handleUploadFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
    }
  }, []);

  const handleRetake = useCallback(() => setMediaUri(null), []);

  const handlePost = useCallback(() => {
    if (!mediaUri || !holdColor) return;
    console.log({
      mediaUri,
      holdColour: holdColor,
      grade: difficulty ?? '',
      project: project ?? 'new',
      ascentType: 'attempt',
    });
    // TODO: wire to useVisionPipeline()
    void submitVision(mediaUri, holdColor);
    setIsProcessing(true);
  }, [mediaUri, holdColor, difficulty, project, submitVision]);

  const isPostEnabled = mediaUri !== null && holdColor !== null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* PROJECT */}
          <Text style={styles.sectionLabel}>Project</Text>
          <Pressable style={styles.pickerRow} onPress={() => setProjectPickerVisible(true)}>
            <Text style={[styles.pickerText, !project && styles.pickerPlaceholder]}>
              {project ? (PROJECTS.find((p) => p.id === project)?.label ?? 'Unknown') : 'Select Project'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#c2c6d4" />
          </Pressable>

          {/* MEDIA */}
          <View style={styles.mediaSectionGap} />
          {!mediaUri ? (
            <>
              <Pressable style={styles.actionCard} onPress={handleCapturePhoto}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(168,200,255,0.1)' }]}>
                  <MaterialCommunityIcons name="camera" size={28} color="#a8c8ff" />
                </View>
                <Text style={styles.cardTitle}>Capture Photo/Video</Text>
                <Text style={styles.cardSubtitle}>Open camera to record now</Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={handleUploadFromLibrary}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(178,199,240,0.1)' }]}>
                  <MaterialCommunityIcons name="cloud-upload" size={28} color="#b2c7f0" />
                </View>
                <Text style={styles.cardTitle}>Upload from Library</Text>
                <Text style={styles.cardSubtitle}>Choose from your device gallery</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.thumbnailContainer}>
              <Image source={{ uri: mediaUri }} style={styles.thumbnail} resizeMode="cover" />
              <Pressable style={styles.retakeButton} onPress={handleRetake}>
                <MaterialCommunityIcons name="restore" size={18} color="#e5e2e1" />
              </Pressable>
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
            <MaterialCommunityIcons name="chevron-down" size={20} color="#c2c6d4" />
          </Pressable>

          {/* DIFFICULTY */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Difficulty</Text>
          <Pressable style={styles.pickerRow} onPress={() => setDifficultyPickerVisible(true)}>
            <Text style={[styles.pickerText, !difficulty && styles.pickerPlaceholder]}>
              {difficulty ?? 'Select Grade/V-Scale'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#c2c6d4" />
          </Pressable>

          {/* POST */}
          <Pressable
            style={[styles.postButton, !isPostEnabled && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!isPostEnabled}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.overlay}>
          <Animated.View style={spinnerStyle}>
            <ActivityIndicator size="large" color="#a8c8ff" />
          </Animated.View>
          <Text style={styles.processingText}>{processingMessage}</Text>
          {/* TODO: wire to useVisionPipeline() */}
        </View>
      )}

      {/* Project picker modal */}
      <Modal
        visible={projectPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProjectPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setProjectPickerVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Project</Text>

            <Pressable
              style={styles.modalRow}
              onPress={() => {
                setProject('new');
                setProjectPickerVisible(false);
                // TODO: navigate to project creation flow
              }}
            >
              <Text style={[styles.modalRowText, styles.modalRowCreate]}>+ Create New Project</Text>
            </Pressable>

            {PROJECTS.map((p) => (
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
                  <MaterialCommunityIcons name="check" size={16} color="#a8c8ff" />
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
                  <Text style={[styles.modalRowText, holdColor === color.hex && styles.modalRowActiveText]}>
                    {color.label}
                  </Text>
                </View>
                {holdColor === color.hex && (
                  <MaterialCommunityIcons name="check" size={16} color="#a8c8ff" />
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
                  <Text style={[styles.modalRowText, difficulty === item && styles.modalRowActiveText]}>
                    {item}
                  </Text>
                  {difficulty === item && (
                    <MaterialCommunityIcons name="check" size={16} color="#a8c8ff" />
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
  container: { flex: 1, backgroundColor: '#131313' },
  flex:      { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Section labels
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#c2c6d4',
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 24,
  },

  // Picker rows
  pickerRow: {
    backgroundColor: '#201f1f',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.15)',
  },
  pickerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerText: {
    fontSize: 16,
    color: '#e5e2e1',
  },
  pickerPlaceholder: {
    color: '#c2c6d4',
  },

  // Color dot
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Media section
  mediaSectionGap: { height: 24 },

  actionCard: {
    backgroundColor: '#201f1f',
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.10)',
    gap: 12,
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
    color: '#e5e2e1',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#c2c6d4',
    textAlign: 'center',
  },

  // Thumbnail preview
  thumbnailContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(14,14,14,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // POST button
  postButton: {
    backgroundColor: '#a8c8ff',
    borderRadius: 6,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 48,
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: '#003062',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
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
    color: '#e5e2e1',
    fontSize: 16,
    marginTop: 20,
  },

  // Picker modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1c1b1b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
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
    color: '#c2c6d4',
    marginBottom: 12,
  },
  modalRow: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#201f1f',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalRowText: {
    fontSize: 16,
    color: '#e5e2e1',
  },
  modalRowActiveText: {
    color: '#a8c8ff',
  },
  modalRowCreate: {
    color: '#a8c8ff',
    fontWeight: '700',
  },
});
