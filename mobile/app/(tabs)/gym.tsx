import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/stores/authStore';

/**
 * Gym tab — shows the user's home gym inline, or a prompt to set one.
 * Tapping the gym navigates to the full GymScreen.
 */
export default function GymTabScreen() {
  const router = useRouter();
  const homeGymId = useAuthStore((s) => s.user?.home_gym_id);
  const homeGymName = useAuthStore((s) => s.user?.home_gym_name ?? null);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!homeGymId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.prompt}>Set your home gym to browse problems.</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/(tabs)/account')}>
          <Text style={styles.btnText}>Go to Account</Text>
        </Pressable>
      </View>
    );
  }

  // Navigate immediately when the tab mounts, showing the full GymScreen
  return (
    <View style={styles.centered}>
      <Text style={styles.gymName}>{homeGymName ?? 'My Gym'}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => router.push({ pathname: '/gym/[gymId]', params: { gymId: homeGymId } })}>
        <Text style={styles.btnText}>View problems →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  prompt: { fontSize: 16, color: '#374151', textAlign: 'center' },
  gymName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  btn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
