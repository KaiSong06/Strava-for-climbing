import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function GymScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Gym</Text>
      <Text>Active problems and gym stats will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
});
