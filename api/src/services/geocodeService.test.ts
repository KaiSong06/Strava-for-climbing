import { geocodeAddress } from './geocodeService';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('geocodeAddress', () => {
  it('should return lat/lng for a valid address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '45.5017', lon: '-73.5673' }],
    });

    const result = await geocodeAddress('Montreal, QC');

    expect(result).toEqual({ lat: 45.5017, lng: -73.5673 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('q=Montreal');
  });

  it('should return null when API returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await geocodeAddress('Invalid');

    expect(result).toBeNull();
  });

  it('should return null when no results found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await geocodeAddress('Nonexistent Place XYZZY');

    expect(result).toBeNull();
  });

  it('should include User-Agent header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '0', lon: '0' }],
    });

    await geocodeAddress('Test');

    const opts = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(opts.headers).toEqual({ 'User-Agent': 'Crux-Climbing-App/1.0' });
  });
});
