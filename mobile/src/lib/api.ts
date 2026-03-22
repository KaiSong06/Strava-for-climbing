/**
 * Base API client for the Crux backend.
 * Automatically attaches the Bearer token from authStore and handles
 * 401 responses by attempting a token refresh before retrying once.
 */
import { useAuthStore } from '../stores/authStore';

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

// Module-level guard: ensures only one refresh attempt is in-flight at a time.
// All concurrent 401s await the same Promise, then retry with the new token.
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const { refreshToken, updateAccessToken, logout } = useAuthStore.getState();

  if (!refreshToken) {
    logout();
    throw new ApiError('UNAUTHORIZED', 'No refresh token available', 401);
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    logout();
    throw new ApiError('UNAUTHORIZED', 'Session expired — please log in again', 401);
  }

  const { accessToken } = (await res.json()) as { accessToken: string };
  updateAccessToken(accessToken);
  return accessToken;
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
    // Deduplicate concurrent refresh attempts
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = null;
    });

    const newToken = await refreshPromise;
    return request<T>(path, {
      ...options,
      _retry: true,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
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
