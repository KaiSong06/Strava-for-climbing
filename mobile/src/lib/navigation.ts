import type { Router } from 'expo-router';

/**
 * Typed route descriptor. Using a loose-ish union of known routes avoids the
 * verbose cast-to-router-push-parameter pattern scattered across screens,
 * while keeping pathname strings literal-checked.
 *
 * The listed variants cover every route the app currently pushes to. The
 * trailing fallback keeps this forward-compatible for ad-hoc pathnames.
 */
export type AppRoute =
  | { pathname: '/profile/[username]'; params: { username: string } }
  | { pathname: '/problem/[id]'; params: { id: string } }
  | { pathname: '/gym/[gymId]'; params: { gymId: string } }
  | { pathname: '/log-ascent/[problemId]'; params: { problemId: string } }
  | { pathname: '/ascent/[id]'; params: { id: string } }
  | { pathname: '/ascent-history/[username]'; params: { username: string } }
  | {
      pathname: '/follow-list';
      params: { mode: 'followers' | 'following'; username: string };
    }
  | { pathname: '/edit-profile' }
  | { pathname: string; params?: Record<string, string> }; // fallback

/**
 * Navigate via expo-router's push() without the ugly router-param cast
 * consumers would otherwise need. Strictly typed for the known routes
 * above; falls through to untyped for anything else (and still works).
 */
export function navigate(router: Router, route: AppRoute): void {
  // expo-router's typed-routes feature narrows push() to an intersection
  // of all valid route objects. Our AppRoute union is wider, so we cast
  // once here so consumers don't have to.
  (router.push as (r: AppRoute) => void)(route);
}
