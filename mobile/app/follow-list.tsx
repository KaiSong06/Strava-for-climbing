import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function FollowListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Follow list — coming in Phase 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholder: { fontSize: 16, opacity: 0.5 },
});
