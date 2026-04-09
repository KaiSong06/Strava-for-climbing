import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { api } from '@/src/lib/api';

interface ProblemSummary {
  id: string;
  colour: string;
  consensus_grade: string | null;
  gym_name: string;
}

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
];
const VISIBILITY = ['public', 'friends', 'private'] as const;
type Visibility = (typeof VISIBILITY)[number];

export default function LogAscentScreen() {
  const { problemId } = useLocalSearchParams<{ problemId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [grade, setGrade] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['problem', problemId],
    queryFn: () => api.get<{ problem: ProblemSummary }>(`/problems/${problemId}`),
  });

  const problem = data?.problem;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/ascents', {
        problem_id: problemId,
        user_grade: grade,
        rating,
        notes: notes.trim() || null,
        visibility,
      });
      // Invalidate problem + feed caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['problem', problemId] }),
        queryClient.invalidateQueries({ queryKey: ['feed'] }),
      ]);
      router.back();
    } catch {
      setError('Failed to log ascent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {problem && (
        <View style={styles.problemHeader}>
          <View style={[styles.swatch, { backgroundColor: problem.colour }]} />
          <View>
            <Text style={styles.grade}>{problem.consensus_grade ?? 'Ungraded'}</Text>
            <Text style={styles.gym}>{problem.gym_name}</Text>
          </View>
        </View>
      )}

      <Text style={styles.label}>Your grade</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
        <View style={styles.gradeRow}>
          {GRADES.map((g) => (
            <AccessiblePressable
              key={g}
              accessibilityLabel={`Grade ${g}`}
              accessibilityState={{ selected: grade === g }}
              style={[styles.gradeChip, grade === g && styles.gradeChipSelected]}
              onPress={() => setGrade(g === grade ? null : g)}
            >
              <Text style={[styles.gradeChipText, grade === g && styles.gradeChipTextSelected]}>
                {g}
              </Text>
            </AccessiblePressable>
          ))}
        </View>
      </ScrollView>

      <Text style={styles.label}>Rating</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <AccessiblePressable
            key={n}
            accessibilityLabel={`Rate ${n} star${n === 1 ? '' : 's'}`}
            accessibilityState={{ selected: (rating ?? 0) >= n }}
            onPress={() => setRating(n === rating ? null : n)}
          >
            <Text style={[styles.star, (rating ?? 0) >= n && styles.starFilled]}>★</Text>
          </AccessiblePressable>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        accessibilityLabel="Notes"
        accessibilityHint="Add any beta, conditions, or thoughts about this climb"
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any beta, conditions, thoughts..."
        placeholderTextColor="#9ca3af"
        multiline
        maxLength={280}
      />
      <Text style={styles.charCount}>{notes.length}/280</Text>

      <Text style={styles.label}>Visibility</Text>
      <View style={styles.visRow}>
        {VISIBILITY.map((v) => (
          <AccessiblePressable
            key={v}
            accessibilityLabel={`Visibility: ${v}`}
            accessibilityState={{ selected: visibility === v }}
            style={[styles.visChip, visibility === v && styles.visChipSelected]}
            onPress={() => setVisibility(v)}
          >
            <Text style={[styles.visChipText, visibility === v && styles.visChipTextSelected]}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </AccessiblePressable>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <AccessiblePressable
        accessibilityLabel="Log ascent"
        accessibilityState={{ busy: submitting, disabled: submitting }}
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Log ascent</Text>
        )}
      </AccessiblePressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },

  problemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
  },
  swatch: { width: 44, height: 44, borderRadius: 8 },
  grade: { fontSize: 18, fontWeight: '700', color: '#111827' },
  gym: { fontSize: 13, color: '#6b7280' },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 8 },

  gradeScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  gradeRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  gradeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gradeChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  gradeChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  gradeChipTextSelected: { color: '#fff' },

  starRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 28, color: '#d1d5db' },
  starFilled: { color: '#f59e0b' },

  notesInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#9ca3af', textAlign: 'right' },

  visRow: { flexDirection: 'row', gap: 8 },
  visChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  visChipSelected: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  visChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  visChipTextSelected: { color: '#2563eb' },

  errorText: { color: '#dc2626', fontSize: 13 },

  submitBtn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
