import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import { uploadPhotos, pollStatus, confirmMatch } from '@/src/services/uploadService';
import type { Gym } from '../../../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6;

type AscentVisibility = 'public' | 'friends' | 'private';

interface CapturedPhoto {
  uri: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HOLD_COLOURS = [
  { label: 'Red',    hex: '#ef4444' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Green',  hex: '#22c55e' },
  { label: 'Blue',   hex: '#3b82f6' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Pink',   hex: '#ec4899' },
  { label: 'Black',  hex: '#1f2937' },
  { label: 'White',  hex: '#f9fafb' },
  { label: 'Gray',   hex: '#6b7280' },
];

const GRADES = [
  'VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8',
  'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17',
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecordScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const homeGymId = useAuthStore((s) => s.user?.home_gym_id ?? null);

  const [step, setStep] = useState<Step>(1);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [colour, setColour] = useState<string>('');
  const [gymId, setGymId] = useState<string>(homeGymId ?? '');

  // Step 4 state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('Uploading…');

  // Step 5 state
  const [uploadId, setUploadId] = useState('');

  // Step 6 state
  const [selectedProblemId, setSelectedProblemId] = useState<string | 'new'>('new');
  const [grade, setGrade] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<AscentVisibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Gyms
  const { data: gymsData } = useQuery({
    queryKey: ['gyms'],
    queryFn: () => api.get<Gym[]>('/gyms'),
  });

  // ─── Step helpers ──────────────────────────────────────────────────────────

  const resetFlow = useCallback(() => {
    setStep(1);
    setPhotos([]);
    setColour('');
    setGymId(homeGymId ?? '');
    setUploadProgress(0);
    setUploadId('');
    setGrade(null);
    setRating(null);
    setNotes('');
    setVisibility('public');
    setError(null);
  }, [homeGymId]);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        setPhotos((prev) => [...prev, { uri: photo.uri }].slice(0, 5));
      }
    } catch {
      setError('Failed to capture photo');
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - photos.length,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => ({ uri: a.uri }))].slice(0, 5));
    }
  }, [photos.length]);

  const startUpload = useCallback(async () => {
    setError(null);
    setStep(4);
    setProcessingLabel('Uploading…');
    setUploadProgress(0);

    try {
      const id = await uploadPhotos(photos, colour, gymId, (p) => setUploadProgress(p));
      setUploadId(id);

      setProcessingLabel('Analysing wall…');
      const status = await pollStatus(id);

      if (status.status === 'awaiting_confirmation') {
        setSelectedProblemId(status.matchedProblemId ?? 'new');
        setStep(5);
      } else {
        setError(`Unexpected status: ${status.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }, [photos, colour, gymId]);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await confirmMatch(uploadId, {
        problemId: selectedProblemId,
        user_grade: grade,
        rating,
        notes: notes.trim() || null,
        visibility,
      });
      // Invalidate the feed so the new ascent appears immediately
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      resetFlow();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log climb');
    } finally {
      setSubmitting(false);
    }
  }, [uploadId, selectedProblemId, grade, rating, notes, visibility, queryClient, resetFlow, router]);

  // ─── Render steps ──────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <SafeAreaView style={styles.flex}>
        <StepHeader title="Photos" step={1} onBack={null} />

        {/* Camera */}
        {!cameraPermission?.granted ? (
          <View style={styles.centered}>
            <Text style={styles.bodyText}>Camera access is needed to photograph holds.</Text>
            <Pressable style={styles.btn} onPress={requestCameraPermission}>
              <Text style={styles.btnText}>Grant Camera Access</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        )}

        {/* Photo strip */}
        <View style={styles.photoStrip}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p.uri }} style={styles.thumbnail} />
          ))}
          <Text style={styles.photoCount}>{photos.length}/5 photos</Text>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.btnSecondary} onPress={takePhoto} disabled={photos.length >= 5}>
            <Text style={styles.btnSecondaryText}>Capture</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={pickFromLibrary} disabled={photos.length >= 5}>
            <Text style={styles.btnSecondaryText}>Library</Text>
          </Pressable>
        </View>

        {photos.length >= 2 && (
          <Pressable style={styles.btn} onPress={() => setStep(2)}>
            <Text style={styles.btnText}>Next →</Text>
          </Pressable>
        )}
        {photos.length < 2 && (
          <Text style={styles.hint}>Add at least 2 photos to continue</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </SafeAreaView>
    );
  }

  if (step === 2) {
    return (
      <SafeAreaView style={styles.flex}>
        <StepHeader title="Hold Colour" step={2} onBack={() => setStep(1)} />
        <Text style={styles.subheading}>What colour are the holds?</Text>

        {/* First photo reference */}
        <Image source={{ uri: photos[0]!.uri }} style={styles.referencePhoto} resizeMode="cover" />

        {/* Colour grid */}
        <View style={styles.colourGrid}>
          {HOLD_COLOURS.map((c) => (
            <Pressable
              key={c.hex}
              style={[
                styles.colourSwatch,
                { backgroundColor: c.hex },
                colour === c.hex && styles.colourSwatchSelected,
              ]}
              onPress={() => setColour(c.hex)}
            >
              {colour === c.hex && <View style={styles.colourCheckDot} />}
            </Pressable>
          ))}
        </View>

        {colour ? (
          <View style={styles.selectedColourRow}>
            <View style={[styles.colourPreview, { backgroundColor: colour }]} />
            <Text style={styles.bodyText}>
              {HOLD_COLOURS.find((c) => c.hex === colour)?.label ?? 'Custom'}
            </Text>
          </View>
        ) : null}

        <Pressable style={[styles.btn, !colour && styles.btnDisabled]} disabled={!colour} onPress={() => setStep(3)}>
          <Text style={styles.btnText}>Next →</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 3) {
    return (
      <SafeAreaView style={styles.flex}>
        <StepHeader title="Gym" step={3} onBack={() => setStep(2)} />
        <Text style={styles.subheading}>Which gym is this?</Text>

        {!gymsData ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            data={gymsData}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.gymList}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.gymRow, gymId === item.id && styles.gymRowSelected]}
                onPress={() => setGymId(item.id)}
              >
                <View style={styles.gymRowLeft}>
                  <Text style={styles.gymName}>{item.name}</Text>
                  <Text style={styles.gymCity}>{item.city}</Text>
                </View>
                {gymId === item.id && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            )}
          />
        )}

        <Pressable style={[styles.btn, !gymId && styles.btnDisabled]} disabled={!gymId} onPress={startUpload}>
          <Text style={styles.btnText}>Upload & Analyse →</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (step === 4) {
    return (
      <SafeAreaView style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.processingLabel}>{processingLabel}</Text>

        {processingLabel === 'Uploading…' && (
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
          </View>
        )}
        {error && (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btn} onPress={resetFlow}>
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    );
  }

  if (step === 5) {
    return (
      <SafeAreaView style={styles.flex}>
        <StepHeader title="Confirm Problem" step={5} onBack={null} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.confirmCard}>
            <Text style={styles.sectionTitle}>New problem detected</Text>
            <Text style={styles.bodyText}>
              We couldn't find an existing problem that matches your climb. A new problem will
              be created for your gym.
            </Text>
          </View>
          <Pressable style={styles.btn} onPress={() => { setSelectedProblemId('new'); setStep(6); }}>
            <Text style={styles.btnText}>Yes, create new problem →</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={resetFlow}>
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 6 — Log ascent
  return (
    <SafeAreaView style={styles.flex}>
      <StepHeader title="Log Climb" step={6} onBack={() => setStep(5)} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Grade picker */}
        <Text style={styles.fieldLabel}>Grade</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
          {GRADES.map((g) => (
            <Pressable
              key={g}
              style={[styles.gradeChip, grade === g && styles.gradeChipSelected]}
              onPress={() => setGrade(g)}
            >
              <Text style={[styles.gradeChipText, grade === g && styles.gradeChipTextSelected]}>
                {g}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Star rating */}
        <Text style={styles.fieldLabel}>Rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3].map((s) => (
            <Pressable key={s} onPress={() => setRating(rating === s ? null : s)}>
              <Text style={[styles.star, (rating ?? 0) >= s && styles.starFilled]}>★</Text>
            </Pressable>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add a note…"
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={280}
          value={notes}
          onChangeText={setNotes}
        />
        <Text style={styles.charCount}>{notes.length}/280</Text>

        {/* Visibility */}
        <Text style={styles.fieldLabel}>Visibility</Text>
        <View style={styles.segmentRow}>
          {(['public', 'friends', 'private'] as AscentVisibility[]).map((v) => (
            <Pressable
              key={v}
              style={[styles.segment, visibility === v && styles.segmentSelected]}
              onPress={() => setVisibility(v)}
            >
              <Text style={[styles.segmentText, visibility === v && styles.segmentTextSelected]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.btn, submitting && styles.btnDisabled]}
          disabled={submitting}
          onPress={handleConfirm}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Log climb</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({
  title,
  step,
  onBack,
}: {
  title: string;
  step: Step;
  onBack: (() => void) | null;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.stepIndicator}>{step}/6</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  scrollContent: { padding: 16, gap: 12 },
  loader: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepIndicator: { fontSize: 13, color: '#6b7280', minWidth: 28, textAlign: 'right' },
  backBtn: { minWidth: 60 },
  backBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '500' },

  // Step 1 — Camera
  camera: { flex: 1 },
  photoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  thumbnail: { width: 48, height: 48, borderRadius: 6 },
  photoCount: { fontSize: 13, color: '#6b7280', marginLeft: 'auto' },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  hint: { textAlign: 'center', color: '#6b7280', fontSize: 13, paddingBottom: 8 },

  // Step 2 — Colour
  referencePhoto: { height: 180, marginHorizontal: 16, borderRadius: 12, marginBottom: 12 },
  colourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  colourSwatch: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  colourSwatchSelected: { borderColor: '#1d4ed8', borderWidth: 3 },
  colourCheckDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  selectedColourRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  colourPreview: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },

  // Step 3 — Gym
  gymList: { padding: 16, gap: 8 },
  gymRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  gymRowSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  gymRowLeft: { flex: 1 },
  gymName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  gymCity: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  checkmark: { fontSize: 18, color: '#2563eb', fontWeight: '700' },

  // Step 4 — Processing
  processingLabel: { fontSize: 16, color: '#374151', textAlign: 'center' },
  progressBarTrack: { width: '80%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#2563eb', borderRadius: 3 },

  // Step 5 — Confirm
  confirmCard: { padding: 16, borderRadius: 12, backgroundColor: '#eff6ff', gap: 8 },

  // Step 6 — Log ascent
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 8 },
  gradeScroll: { flexGrow: 0 },
  gradeChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e5e7eb', marginRight: 8,
  },
  gradeChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  gradeChipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  gradeChipTextSelected: { color: '#fff' },
  starsRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  star: { fontSize: 32, color: '#d1d5db' },
  starFilled: { color: '#f59e0b' },
  notesInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#111827',
    minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  segmentRow: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: '#e5e7eb' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  segmentSelected: { backgroundColor: '#2563eb' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  segmentTextSelected: { color: '#fff' },

  // Shared
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subheading: { fontSize: 15, color: '#374151', paddingHorizontal: 16, paddingBottom: 12 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  btn: {
    margin: 16, padding: 16, backgroundColor: '#2563eb',
    borderRadius: 14, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    marginHorizontal: 16, marginBottom: 8, padding: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
});
