interface GeocodedLocation {
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

export async function geocodeAddress(address: string): Promise<GeocodedLocation | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Crux-Climbing-App/1.0' },
  });

  if (!res.ok) {
    return null;
  }

  const results = (await res.json()) as NominatimResult[];
  if (results.length === 0) {
    return null;
  }

  return {
    lat: parseFloat(results[0]!.lat),
    lng: parseFloat(results[0]!.lon),
  };
}
