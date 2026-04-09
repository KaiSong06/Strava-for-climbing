import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import { toast } from '../components/ui/ToastProvider';

const DEFAULT_STALE_TIME_MS = 30_000;

/**
 * Translate an unknown error thrown from a mutation/query into a
 * user-friendly sentence. Safe to call from anywhere — React components,
 * QueryClient callbacks, services.
 */
export function classifyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 401) return 'Please sign in again.';
    if (err.statusCode === 403) return "You don't have permission to do that.";
    if (err.statusCode === 404) return "That doesn't exist anymore.";
    if (err.statusCode >= 500) return 'Something went wrong. Please try again.';
    if (err.statusCode >= 400) return err.message;
    // Network / zero-status errors surfaced as ApiError still have a message.
    if (err.message) return err.message;
    return 'Unexpected error. Please try again.';
  }

  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    if (err.name === 'AbortError') return 'Request timed out. Please try again.';
  }

  if (err instanceof TypeError && /network request failed/i.test(err.message)) {
    return 'No internet connection.';
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Request timed out. Please try again.';
    if (/timeout|timed out/i.test(err.message)) return 'Request timed out. Please try again.';
    if (/network request failed/i.test(err.message)) return 'No internet connection.';
  }

  return 'Unexpected error. Please try again.';
}

/**
 * Shared QueryClient instance for the whole app.
 * - Queries default to a 30 s stale time for cheap deduplication.
 * - Mutation errors auto-surface a toast via the module-level bridge.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME_MS,
    },
    mutations: {
      onError: (err) => {
        toast.error(classifyError(err));
      },
    },
  },
});
