# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `mobile/` directory.

## Overview

React Native (Expo) app for iOS and Android. Expo Router for file-based routing, Zustand for state, TanStack React Query for server state, Supabase Auth for phone-based authentication.

## Commands

```bash
npx expo start                  # dev server
npx expo start --ios            # iOS simulator
npx expo start --android        # Android emulator
npx tsc --noEmit                # type-check
```

## Project Structure

```
app/                    # Expo Router file-based routes
  (auth)/               # Auth screens: login, register, verify-phone
  (tabs)/               # Tab screens: index (feed), search, record, gym, account
  profile/[username]    # Dynamic routes
  gym/[gymId], problem/[id], log-ascent/[problemId], feed/gym
src/
  screens/              # Screen implementations (app/ routes re-export these)
  components/           # Shared: FeedCard, FollowButton, ProblemCard, TabBar
  hooks/                # useVisionPipeline, useMatchResult
  stores/               # Zustand: authStore, followStore
  services/             # pushService, uploadService
  lib/                  # api.ts (REST client), supabase.ts (Supabase client)
  theme/                # colors.ts, spacing.ts, typography.ts
```

## Screen Organisation

- Simple screens: `src/screens/<Name>Screen.tsx`
- Complex screens: `src/screens/<Name>/` with `<Name>Screen.tsx` + `components/` subfolder
- Tab routes in `app/(tabs)/` are thin re-exports: `export { default } from '@/src/screens/...'`

## Auth Flow

Mobile calls Supabase Auth directly (not the backend API):
1. **Register**: `supabase.auth.signUp({ phone, password })` → OTP sent via SMS
2. **Verify**: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
3. **Login**: `supabase.auth.signInWithPassword({ phone, password })`
4. **Logout**: `supabase.auth.signOut()`

Phone numbers are Canada-only — UI collects 10 digits, app prepends `+1`.

`AuthGate` in `app/_layout.tsx` watches session state and redirects:
- No session + no pending verification → `/(auth)/login`
- Pending verification → `/(auth)/verify-phone`
- Session exists → `/(tabs)`

## State Management

- **authStore** (Zustand) — `session`, `user`, `pendingVerification`, `accessToken`, `_hasHydrated`. Initializes via `supabase.auth.getSession()` and subscribes to `onAuthStateChange`.
- **followStore** (Zustand) — optimistic follow/unfollow with rollback on failure.
- **React Query** — all API data fetching (feeds, profiles, ascents, gyms).

## API Client

`src/lib/api.ts` — auto-attaches Supabase access token, handles 401 by refreshing session once via `supabase.auth.refreshSession()`. Throws `ApiError(code, message, statusCode)`.

## Theme (Midnight Editorial)

Always import from `src/theme/` — never hardcode values:
- `colors.ts` — dark palette. No pure white (`#FFFFFF`), use `colors.onSurface`.
- `spacing.ts` — 4px grid: xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48.
- `typography.ts` — Inter-only scale. Spread onto Text styles.

**Design rules**: No 1px borders for sectioning (use background color tiers). No drop shadows (use tonal layering). No dividers between list items (use spacing/color shifts).

## Vision Pipeline (Record Screen)

`useVisionPipeline` hook manages: upload photos → poll status → confirm match.
- States: idle → uploading → processing → matched/awaiting_confirmation/failed → confirmed
- `uploadService.ts` handles multipart upload, polling (2s interval), and confirm POST.

## Path Alias

`@/*` maps to the mobile root (e.g., `@/src/stores/authStore`).

## TypeScript

- Strict mode, extends `expo/tsconfig.base`
- Typed routes enabled (`experiments.typedRoutes: true` in app.json)
- `shared/types.ts` imported via relative path (`../../../shared/types`)
