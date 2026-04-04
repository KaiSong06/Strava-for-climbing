import { useMemo } from 'react';
import type { UploadStatusResponse } from '../services/uploadService';

export function useMatchResult(result: UploadStatusResponse | null) {
  return useMemo(() => {
    if (!result) {
      return {
        matchedProblemId: null as string | null,
        confidence: null as number | null,
        needsConfirmation: false,
        isAutoMatched: false,
        isUnmatched: false,
      };
    }

    return {
      matchedProblemId: result.matchedProblemId,
      confidence:
        result.similarityScore !== null
          ? Math.round(result.similarityScore * 100)
          : null,
      needsConfirmation: result.status === 'awaiting_confirmation',
      isAutoMatched: result.status === 'matched',
      isUnmatched: result.status === 'unmatched',
    };
  }, [result]);
}
