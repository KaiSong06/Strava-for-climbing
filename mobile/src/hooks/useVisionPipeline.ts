// TODO Phase 4b: call FastAPI vision service
import { useState, useCallback } from 'react';

type VisionStatus = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export function useVisionPipeline() {
  const [status, setStatus] = useState<VisionStatus>('idle');
  const [result] = useState<null>(null);

  const submit = useCallback(async (_uri: string, _colour: string): Promise<void> => {
    setStatus('uploading');
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    setStatus('analyzing');
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    setStatus('complete');
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  return { submit, status, result, reset };
}
