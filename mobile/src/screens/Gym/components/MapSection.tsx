import { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { darkMapStyle } from './mapStyle';
import type { Gym } from '@shared/types';

const DEFAULT_REGION: Region = {
  latitude: 45.42,
  longitude: -75.69,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

interface MapSectionProps {
  onSearch: (address: string) => void;
  isSearching: boolean;
  searchError: string | null;
  gyms: (Gym & { distance_km?: number })[];
  region: { lat: number; lng: number } | null;
}

export function MapSection({ onSearch, isSearching, searchError, gyms, region }: MapSectionProps) {
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (region) {
      mapRef.current?.animateToRegion(
        {
          latitude: region.lat,
          longitude: region.lng,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        },
        600,
      );
    }
  }, [region]);

  function handleSubmit() {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      onSearch(trimmed);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
      >
        {gyms.map((gym) => (
          <Marker
            key={gym.id}
            coordinate={{ latitude: gym.lat, longitude: gym.lng }}
            title={gym.name}
            description={gym.city}
          >
            <View style={styles.markerOuter}>
              <View style={styles.markerInner} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Bottom gradient for search bar blend */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* Frosted-glass search bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          {isSearching ? (
            <ActivityIndicator
              size="small"
              color={`${colors.onSurface}80`}
              style={styles.searchIcon}
            />
          ) : (
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={`${colors.onSurface}80`}
              style={styles.searchIcon}
            />
          )}
          <TextInput
            style={styles.searchInput}
            placeholder="Find a gym near you..."
            placeholderTextColor={`${colors.onSurfaceVariant}b3`}
            returnKeyType="search"
            selectionColor={colors.primary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            editable={!isSearching}
          />
        </View>
        {searchError && <Text style={styles.errorText}>{searchError}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 340,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  markerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.primary}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  searchWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32,31,31,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    ...typography.bodyMd,
    flex: 1,
    color: colors.onSurface,
    padding: 0,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
});
