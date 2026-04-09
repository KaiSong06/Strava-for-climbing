import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Sentry from '@sentry/react-native';
import { Toast, type ToastVariant } from './Toast';

const DEFAULT_ERROR_DURATION = 4000;
const DEFAULT_INFO_DURATION = 2500;

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastApi {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Module-level bridge so non-React callers (queryClient, services) can push toasts.
let activeApi: ToastApi | null = null;

function durationFor(variant: ToastVariant): number {
  return variant === 'error' ? DEFAULT_ERROR_DURATION : DEFAULT_INFO_DURATION;
}

/**
 * Provides a toast queue via context. Only one toast is visible at a time;
 * subsequent toasts enqueue behind the active one.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const enqueue = useCallback((message: string, variant: ToastVariant) => {
    nextIdRef.current += 1;
    const item: ToastItem = {
      id: nextIdRef.current,
      message,
      variant,
      duration: durationFor(variant),
    };
    setQueue((prev) => [...prev, item]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      error: (message: string) => enqueue(message, 'error'),
      success: (message: string) => enqueue(message, 'success'),
      info: (message: string) => enqueue(message, 'info'),
    }),
    [enqueue],
  );

  // Expose the mounted API to non-React callers.
  useEffect(() => {
    activeApi = api;
    return () => {
      if (activeApi === api) activeApi = null;
    };
  }, [api]);

  const handleDismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const current = queue[0];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {current ? (
        <Toast
          key={current.id}
          message={current.message}
          variant={current.variant}
          duration={current.duration}
          onDismiss={handleDismiss}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

/**
 * Module-level toast bridge for callers that live outside the React tree
 * (e.g. the QueryClient `onError` callback, plain services). If the provider
 * isn't mounted yet, the message is logged to Sentry and silently dropped.
 */
export const toast: ToastApi = {
  error: (message: string) => {
    if (activeApi) {
      activeApi.error(message);
      return;
    }
    Sentry.logger.warn('Toast dropped (provider unmounted)', { message, variant: 'error' });
  },
  success: (message: string) => {
    if (activeApi) {
      activeApi.success(message);
      return;
    }
    Sentry.logger.warn('Toast dropped (provider unmounted)', { message, variant: 'success' });
  },
  info: (message: string) => {
    if (activeApi) {
      activeApi.info(message);
      return;
    }
    Sentry.logger.warn('Toast dropped (provider unmounted)', { message, variant: 'info' });
  },
};
