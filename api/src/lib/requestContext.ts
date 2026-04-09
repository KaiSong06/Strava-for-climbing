/**
 * Per-request context backed by Node's AsyncLocalStorage.
 *
 * Propagates a requestId (and optional userId) across async boundaries so that
 * services, jobs, and error handlers can tag their structured logs with the
 * originating request without threading the value through every call site.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Returns the active request context, or undefined outside a request scope. */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Runs `fn` with the given request context bound to AsyncLocalStorage. */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Mutates the active request context in place. Intended for middleware that
 * enriches the context mid-request (e.g. auth middleware adding userId).
 * No-op when called outside a request scope.
 */
export function updateRequestContext(patch: Partial<RequestContext>): void {
  const current = storage.getStore();
  if (!current) return;
  Object.assign(current, patch);
}
