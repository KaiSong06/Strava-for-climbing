import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function RecordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Climb</Text>
      <Text>Camera / photo upload will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
});
