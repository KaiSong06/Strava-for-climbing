/**
 * Hook to load a GLB model from a remote URL.
 *
 * Fetches the GLB as an ArrayBuffer for Three.js GLTFLoader.parse().
 * Uses React Query-like caching via useRef to avoid re-fetching.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseModelLoaderResult {
  arrayBuffer: ArrayBuffer | null;
  loading: boolean;
  error: Error | null;
}

export function useModelLoader(modelUrl: string | null): UseModelLoaderResult {
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, ArrayBuffer>>(new Map());

  const loadModel = useCallback(async (url: string) => {
    // Check in-memory cache
    const cached = cacheRef.current.get(url);
    if (cached) {
      setArrayBuffer(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download model: HTTP ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      cacheRef.current.set(url, buffer);
      setArrayBuffer(buffer);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load model'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (modelUrl) {
      void loadModel(modelUrl);
    } else {
      setArrayBuffer(null);
      setLoading(false);
      setError(null);
    }
  }, [modelUrl, loadModel]);

  return { arrayBuffer, loading, error };
}
