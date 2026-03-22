import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// Phase 4 — stub: shows problem ID until full problem detail is implemented
export default function ProblemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Problem</Text>
      <Text style={styles.id}>{id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  label: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  id: { fontSize: 12, fontFamily: 'SpaceMono', color: '#374151' },
});
