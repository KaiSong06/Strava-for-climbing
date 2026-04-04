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
 * Upload photos as multipart/form-data via XMLHttpRequest so progress events fire.
 * Returns the uploadId from the server.
 */
export function uploadPhotos(
  photos: { uri: string }[],
  colour: string,
  gymId: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    photos.forEach((photo, i) => {
      // React Native's networking layer accepts { uri, name, type } appended to FormData
      formData.append('photos', {
        uri: photo.uri,
        name: `photo_${i}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
    });
    formData.append('colour', colour);
    formData.append('gym_id', gymId);

    const { accessToken } = useAuthStore.getState();
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText) as { uploadId: string };
          resolve(data.uploadId);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText) as { error?: { message: string } };
          if (err.error) message = err.error.message;
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));

    xhr.open('POST', `${BASE_URL}/uploads`);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.timeout = 120_000; // 2-minute upload timeout
    xhr.send(formData);
  });
}

/**
 * Polls GET /uploads/:id/status every 2 s until the status leaves
 * 'pending' or 'processing'. Resolves with the final status response.
 */
export async function pollStatus(uploadId: string): Promise<UploadStatusResponse> {
  while (true) {
    const status = await api.get<UploadStatusResponse>(`/uploads/${uploadId}/status`);
    if (status.status !== 'pending' && status.status !== 'processing') {
      return status;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  }
}

/** Calls POST /uploads/:id/confirm with the problem selection + ascent data. */
export async function confirmMatch(
  uploadId: string,
  body: ConfirmBody,
): Promise<{ ascentId: string; problemId: string }> {
  return api.post<{ ascentId: string; problemId: string }>(`/uploads/${uploadId}/confirm`, body);
}
