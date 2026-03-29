import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { NearbyGym } from '../../../shared/types';

interface NearbyGymsParams {
  lat: number;
  lng: number;
  radius?: number;
}

export function useNearbyGyms(params: NearbyGymsParams | null) {
  return useQuery({
    queryKey: ['gyms', 'nearby', params],
    queryFn: async () => {
      const { lat, lng, radius } = params!;
      const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      if (radius) qs.set('radius', String(radius));
      const res = await api.get<{ data: NearbyGym[] }>(`/gyms/nearby?${qs}`);
      return res.data;
    },
    enabled: params !== null,
    staleTime: 5 * 60 * 1000,
  });
}
