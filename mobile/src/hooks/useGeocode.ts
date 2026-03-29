import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

interface GeocodedLocation {
  lat: number;
  lng: number;
}

export function useGeocode() {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocode = useCallback(async (address: string): Promise<GeocodedLocation | null> => {
    setIsGeocoding(true);
    setError(null);
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length === 0) {
        setError('No results found for that address');
        return null;
      }
      const { latitude, longitude } = results[0]!;
      return { lat: latitude, lng: longitude };
    } catch {
      setError('Could not geocode address. Check your connection.');
      return null;
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  return { geocode, isGeocoding, error };
}
