import { useState, useCallback, useRef } from 'react';
import {
  uploadPhotos,
  pollStatus,
  confirmMatch,
  type UploadStatusResponse,
  type ConfirmBody,
} from '../services/uploadService';

export type PipelineStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'matched'
  | 'awaiting_confirmation'
  | 'failed'
  | 'confirmed';

export function useVisionPipeline() {
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [result, setResult] = useState<UploadStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guard against setting state after unmount / reset
  const activeRef = useRef(false);

  const submit = useCallback(
    async (
      photos: Array<{ uri: string }>,
      colour: string,
      gymId: string,
    ): Promise<void> => {
      activeRef.current = true;
      setStatus('uploading');
      setUploadProgress(0);
      setUploadId(null);
      setResult(null);
      setError(null);

      try {
        const id = await uploadPhotos(photos, colour, gymId, (p) => {
          if (activeRef.current) setUploadProgress(p);
        });
        if (!activeRef.current) return;

        setUploadId(id);
        setStatus('processing');

        const pollResult = await pollStatus(id);
        if (!activeRef.current) return;

        setResult(pollResult);

        const s = pollResult.status;
        if (s === 'matched') {
          setStatus('matched');
        } else if (s === 'awaiting_confirmation') {
          setStatus('awaiting_confirmation');
        } else {
          setStatus('failed');
          setError('Processing did not produce a match result');
        }
      } catch (err) {
        if (!activeRef.current) return;
        setStatus('failed');
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    },
    [],
  );

  const confirm = useCallback(
    async (body: ConfirmBody): Promise<{ ascentId: string; problemId: string }> => {
      if (!uploadId) throw new Error('No upload to confirm');
      try {
        const res = await confirmMatch(uploadId, body);
        setStatus('confirmed');
        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to confirm');
        throw err;
      }
    },
    [uploadId],
  );

  const reset = useCallback(() => {
    activeRef.current = false;
    setStatus('idle');
    setUploadProgress(0);
    setUploadId(null);
    setResult(null);
    setError(null);
  }, []);

  return { status, uploadProgress, uploadId, result, error, submit, confirm, reset };
}
