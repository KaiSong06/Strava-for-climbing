/**
 * Base API client for the Crux backend.
 * Automatically attaches the Supabase access token and handles
 * 401 responses by refreshing the session once before retrying.
 */
import { useAuthStore } from '../stores/authStore';
import { supabase } from './supabase';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal flag — prevents infinite retry loop on 401. */
  _retry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, _retry, ...init } = options;
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !_retry) {
    // Attempt one session refresh via Supabase
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) {
      await useAuthStore.getState().logout();
      throw new ApiError('UNAUTHORIZED', 'Session expired — please log in again', 401);
    }

    return request<T>(path, {
      ...options,
      _retry: true,
      headers: { ...headers, Authorization: `Bearer ${data.session.access_token}` },
    });
  }

  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let message = `HTTP ${response.status}`;
    try {
      const json = (await response.json()) as { error?: { code: string; message: string } };
      if (json.error) {
        code = json.error.code;
        message = json.error.message;
      }
    } catch {
      // ignore parse error — use defaults above
    }
    throw new ApiError(code, message, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
