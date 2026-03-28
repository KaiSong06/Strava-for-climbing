import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { api } from '@/src/lib/api';
import { MapSection } from './components/MapSection';
import { GymCard } from './components/GymCard';
import type { Gym } from '../../../../shared/types';

export default function GymScreen() {
  const insets = useSafeAreaInsets();

  const { data: gyms, isLoading, error } = useQuery({
    queryKey: ['gyms'],
    queryFn: () => api.get<{ data: Gym[] }>('/gyms').then((res) => res.data),
  });

  function handleGymPress(_gym: Gym) {
    // TODO: navigate to gym detail screen
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Map hero ─────────────────────────────────────────────────── */}
        <View style={styles.mapWrapper}>
          <MapSection />
        </View>

        {/* ── Section header ───────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>NEARBY HUBS</Text>
            <Text style={styles.sectionSubtitle}>TRAINING GROUNDS IN YOUR AREA</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.filterButton, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={24}
              color={colors.primary}
            />
          </Pressable>
        </View>

        {/* ── Gym cards feed ───────────────────────────────────────────── */}
        <View style={styles.feed}>
          {isLoading && (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          )}
          {error && (
            <Text style={styles.errorText}>Failed to load gyms</Text>
          )}
          {gyms?.map((gym) => (
            <GymCard key={gym.id} gym={gym} onPress={handleGymPress} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 128,
  },
  mapWrapper: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 32,
    color: colors.onSurface,
    textTransform: 'uppercase',
    fontStyle: 'italic',
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  filterButton: {
    backgroundColor: colors.surfaceContainerHigh,
    padding: spacing.sm,
    borderRadius: 12,
  },
  feed: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
