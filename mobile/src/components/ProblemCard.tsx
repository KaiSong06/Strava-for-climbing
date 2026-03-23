import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ProblemCardProps {
  id: string;
  colour: string;
  consensus_grade: string | null;
  total_sends: number;
  flash_count: number;
  retired?: boolean;
  onPress?: () => void;
}

export function ProblemCard({
  colour,
  consensus_grade,
  total_sends,
  flash_count,
  retired = false,
  onPress,
}: ProblemCardProps) {
  return (
    <Pressable style={[styles.card, retired && styles.retired]} onPress={onPress}>
      <View style={[styles.swatch, { backgroundColor: colour }]} />
      <View style={styles.info}>
        <Text style={styles.grade}>{consensus_grade ?? '?'}</Text>
        <View style={styles.meta}>
          <Text style={styles.sends}>{total_sends} sends</Text>
          {flash_count > 0 && <Text style={styles.flash}>⚡</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  retired: { opacity: 0.55 },
  swatch: { height: 64, width: '100%' },
  info: { padding: 10, gap: 4 },
  grade: { fontSize: 15, fontWeight: '700', color: '#111827' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sends: { fontSize: 12, color: '#6b7280' },
  flash: { fontSize: 12 },
});
