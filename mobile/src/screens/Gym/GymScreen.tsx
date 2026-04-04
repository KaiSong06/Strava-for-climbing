import { lazy, Suspense, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { api } from '@/src/lib/api';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
import { useGeocode } from '@/src/hooks/useGeocode';
import { useNearbyGyms } from '@/src/hooks/useNearbyGyms';
import { GymCard } from './components/GymCard';
import type { Gym } from '../../../../shared/types';

// react-native-maps is native-only; lazy-load to avoid web bundling errors
const MapSection = lazy(() =>
  import('./components/MapSection').then((m) => ({ default: m.MapSection })),
);

export default function GymScreen() {
  const insets = useSafeAreaInsets();

  // All gyms (default view before search)
  const {
    data: allGyms,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gyms'],
    queryFn: () => api.get<{ data: Gym[] }>('/gyms').then((res) => res.data),
  });

  // Address search flow
  const { geocode, isGeocoding, error: geocodeError } = useGeocode();
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { data: nearbyGyms, isLoading: isNearbyLoading } = useNearbyGyms(searchCoords);

  async function handleSearch(address: string) {
    const coords = await geocode(address);
    if (coords) {
      setSearchCoords(coords);
    }
  }

  // Show nearby results after search, otherwise all gyms
  const displayGyms = searchCoords ? nearbyGyms : allGyms;
  const isLoadingGyms = searchCoords ? isNearbyLoading : isLoading;

  function handleGymPress(_gym: Gym) {
    // TODO: navigate to gym detail screen
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + BANNER_HEIGHT + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Map hero ─────────────────────────────────────────────────── */}
        <View style={styles.mapWrapper}>
          {Platform.OS !== 'web' ? (
            <Suspense fallback={<ActivityIndicator color={colors.primary} />}>
              <MapSection
                onSearch={handleSearch}
                isSearching={isGeocoding}
                searchError={geocodeError}
                gyms={displayGyms ?? []}
                region={searchCoords}
              />
            </Suspense>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.emptyText}>Map is not available on web</Text>
            </View>
          )}
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
            <MaterialCommunityIcons name="tune-variant" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* ── Gym cards feed ───────────────────────────────────────────── */}
        <View style={styles.feed}>
          {isLoadingGyms && <ActivityIndicator color={colors.primary} style={styles.loader} />}
          {error && !searchCoords && <Text style={styles.errorText}>Failed to load gyms</Text>}
          {displayGyms?.length === 0 && !isLoadingGyms && (
            <Text style={styles.emptyText}>No gyms found nearby. Try a different address.</Text>
          )}
          {displayGyms?.map((gym) => (
            <GymCard
              key={gym.id}
              gym={gym}
              onPress={handleGymPress}
              distance_km={
                'distance_km' in gym
                  ? (gym as Gym & { distance_km: number }).distance_km
                  : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
      <CruxBanner />
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
  mapPlaceholder: {
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
