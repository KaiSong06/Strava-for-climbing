import { useState, useCallback } from 'react';
import { api } from '../lib/api';

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
      const res = await api.get<{ data: GeocodedLocation }>(
        `/gyms/geocode?address=${encodeURIComponent(address)}`,
      );
      return res.data;
    } catch {
      setError('Could not geocode address. Check your connection.');
      return null;
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  return { geocode, isGeocoding, error };
}
