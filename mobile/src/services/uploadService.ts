import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import type { ProcessingStatus } from '../../../shared/types';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export interface UploadStatusResponse {
  status: ProcessingStatus;
  similarityScore: number | null;
  matchedProblemId: string | null;
  candidateProblems: unknown[];
}

export interface ConfirmBody {
  problemId: string | 'new';
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  visibility: 'public' | 'friends' | 'private';
}

/**
 * Upload photos as multipart/form-data via fetch.
 * Returns the uploadId from the server.
 *
 * Note: fetch does not support granular upload progress — onProgress fires
 * 0 at start and 1 on completion. Swap to expo-file-system uploadAsync if
 * real-time progress is needed later.
 */
export async function uploadPhotos(
  photos: Array<{ uri: string }>,
  colour: string,
  gymId: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  const formData = new FormData();
  photos.forEach((photo, i) => {
    formData.append('photos', {
      uri: photo.uri,
      name: `photo_${i}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });
  formData.append('colour', colour);
  formData.append('gym_id', gymId);

  const { accessToken } = useAuthStore.getState();

  onProgress(0);

  const response = await fetch(`${BASE_URL}/uploads`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });

  onProgress(1);

  if (response.status === 201) {
    const data = (await response.json()) as { uploadId: string };
    return data.uploadId;
  }

  let message = `Upload failed (${response.status})`;
  try {
    const err = (await response.json()) as { error?: { message: string } };
    if (err.error) message = err.error.message;
  } catch { /* ignore */ }
  throw new Error(message);
}

/**
 * Polls GET /uploads/:id/status every 2 s until the status leaves
 * 'pending' or 'processing'. Times out after 60 s.
 */
export async function pollStatus(uploadId: string): Promise<UploadStatusResponse> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const status = await api.get<UploadStatusResponse>(`/uploads/${uploadId}/status`);
    if (status.status !== 'pending' && status.status !== 'processing') {
      return status;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error('Processing timed out. Please try again later.');
}

/** Calls POST /uploads/:id/confirm with the problem selection + ascent data. */
export async function confirmMatch(
  uploadId: string,
  body: ConfirmBody,
): Promise<{ ascentId: string; problemId: string }> {
  return api.post<{ ascentId: string; problemId: string }>(`/uploads/${uploadId}/confirm`, body);
}
