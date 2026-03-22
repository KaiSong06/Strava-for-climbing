# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Crux — Strava for Bouldering

Social bouldering app for iOS and Android. Users log climbs, follow friends, and discover problems at their gym. Core differentiator: photo-based hold detection that auto-identifies and clusters problems using computer vision, so every ascent is automatically linked to the correct gym problem without manual entry.

---

## Stack

**Mobile**: React Native (Expo) — single codebase for iOS + Android
**Backend API**: Node.js + Express + TypeScript
**Database**: PostgreSQL with pgvector extension (similarity search)
**Object storage**: S3-compatible (photos, 3D models)
**Vision pipeline**: Python + FastAPI (separate service, async) — **currently a stub; pipeline stages not yet implemented**
**Job queue**: BullMQ (Redis-backed) — vision pipeline runs async, never in-request
**Auth**: JWT + refresh tokens

---

## Repo structure

```
/mobile          React Native (Expo) app
/api             Node.js + Express backend
/vision          Python FastAPI vision pipeline service
/shared          Shared TypeScript types (consumed by mobile + api)
/db              Migrations (pg-migrate), seed scripts
/docs            Specs, ADRs, SQL query references
```

---

## Key commands

```bash
# Mobile
cd mobile && npx expo start
cd mobile && npx expo start --ios      # iOS simulator
cd mobile && npx expo start --android  # Android emulator

# API
cd api && npm run dev              # ts-node-dev, port 3001
cd api && npm run worker:vision    # run stub vision worker (separate process)
cd api && npm run test             # Jest (all tests)
cd api && npx jest --testPathPattern=<pattern>   # run a single test file

# Vision service
cd vision && uvicorn main:app --reload --port 8000
python vision/workers/vision_worker.py  # run worker process separately

# Database
cd api && npm run db:migrate   # run pending migrations
cd api && npm run db:seed      # seed gyms + test users
```

---

## Required environment variables

**API** (`api/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string (e.g. `redis://localhost:6379`)
- `JWT_SECRET` — secret for signing access tokens
- `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT` — S3-compatible object storage
- `PORT` — defaults to `3001`

**Mobile** (`mobile/.env`):
- `EXPO_PUBLIC_API_URL` — backend URL (e.g. `http://localhost:3001`); must have `EXPO_PUBLIC_` prefix to be exposed to the client

**Vision** (`vision/.env`):
- `REDIS_URL` — Redis connection string
- `API_URL` — backend URL (defaults to `http://localhost:3001`)
- `SIMILARITY_THRESHOLD_AUTO` — default `0.92`
- `SIMILARITY_THRESHOLD_CONFIRM` — default `0.75`

---

## Architecture rules

- Vision pipeline is **always async** — jobs are enqueued via BullMQ (queue name: `'vision'`), never called synchronously from API routes. Mobile polls `/uploads/:id/status` or receives push notification on completion. Vision worker POSTs result back to `/uploads/:id/result` on the API.
- pgvector stores `hold_vector float[]` on the `problems` table. Always filter by `gym_id` AND `colour` before running ANN similarity search to reduce candidate set.
- Similarity thresholds: score ≥ 0.92 = auto-match, 0.75–0.91 = prompt user to confirm, < 0.75 = new problem.
- Flash vs send logic: determined at write time by checking if any prior `ascents` row exists for `(user_id, problem_id)`. Never trust user self-report for this.
- Problem retirement: cron job runs nightly, retires problems where `NOW() - first_upload_at > retirement_days` (default 14, configurable per gym).
- Privacy: ascent `visibility` enum is `public | friends | private`. Even private ascents contribute anonymously to problem aggregate stats (`total_sends`, `consensus_grade`).

---

## Data model (key tables)

```
users           id, username, display_name, avatar_url, home_gym_id
gyms            id, name, city, lat, lng, default_retirement_days
problems        id, gym_id, colour, hold_vector, model_url, status, consensus_grade, first_upload_at, retired_at
ascents         id, user_id, problem_id, type (flash|send|attempt), user_grade, rating, visibility, logged_at
uploads         id, user_id, problem_id, photo_urls[], processing_status, similarity_score
follows         follower_id, following_id
match_disputes  id, upload_id, reported_by, status, votes_confirm, votes_split
refresh_tokens  id, user_id, token_hash (indexed), expires_at
```

Key shared types beyond the tables: `FeedItem` (ascent + problem + user + gym aggregated for feed display), `PaginatedResponse<T>` (data[], cursor, has_more), `UserProfile` (User + follower/following counts + home_gym_name).

---

## Code style

- TypeScript strict mode everywhere in `/api` and `/mobile`. No `any`.
- Named exports only — no default exports except screen components in React Native.
- React Native: functional components with hooks. No class components.
- API routes: thin controllers, logic in service layer (`/services`). Never put business logic in route handlers.
- Input validation: use Zod in route handlers before calling services. The global `errorHandler` also catches `ZodError` and returns a 400.
- Two auth middlewares in `api/src/middleware/auth.ts`: `requireAuth` (rejects with 401 if no/invalid token, attaches `req.user`) and `optionalAuth` (attaches `req.user` if a valid Bearer token is present, never rejects — use on public routes where auth enriches but isn't required). Import and apply per-route, not globally.
- Errors: throw `AppError` (from `api/src/middleware/errorHandler.ts`) in services; the global `errorHandler` middleware catches it and returns `{ error: { code, message } }`.
- Never commit `.env` files. Use `.env.example` to document required vars.

---

## Mobile-specific patterns

- **Routing**: Expo Router (file-based). Screens live in `mobile/app/`. The `@/` path alias maps to the `mobile/` root.
- **Server state**: TanStack React Query — use for all API calls.
- **Client state**: Zustand — use for global UI/auth state.
- **API client**: `mobile/src/lib/api.ts` exports `api.get/post/patch/delete`. Always use this instead of raw `fetch`. It reads `EXPO_PUBLIC_API_URL`, auto-attaches the Bearer token, handles 401s by refreshing the token (deduplicating concurrent refresh attempts), and throws `ApiError` on non-2xx responses.
- **Auth store**: `mobile/src/stores/authStore.ts` — Zustand store persisted to `SecureStore`. Check `_hasHydrated` before reading auth state (the root layout gates navigation on this).
- **Follow store**: `mobile/src/stores/followStore.ts` — Zustand store for follow state.
- **Components**: `mobile/src/components/` — `FeedCard` (renders a single feed item), `FollowButton` (follow/unfollow toggle).
- **Shared types**: Import from `shared/types.ts` (not a published package; reference by relative path or configure the path in tsconfig).

---

## Gotchas

- pgvector ANN queries require the `vector` extension to be enabled: `CREATE EXTENSION IF NOT EXISTS vector;` — this is included in `db/migrations/001_initial_schema.sql` but must exist before migrations run.
- The vision pipeline uses MiDaS for depth estimation and SAM ViT-B for segmentation. These models are heavy — do NOT run them in the API process. They belong in `/vision` only. Models are loaded **lazily** (not at startup) to keep the FastAPI service boot fast.
- Expo managed workflow — avoid bare React Native modules unless absolutely necessary. Check Expo SDK compatibility before adding native deps.
- `hold_vector` length varies per problem (2 floats per hold). pgvector requires fixed-dimension vectors — pad all vectors to 200 dims (100 holds max, `vector(200)`) with zeros before storing.
- For matching, sort hold centroids by y-desc before vectorising so ordering is consistent across uploads of the same problem.
- BullMQ job retries: 3 attempts, exponential backoff starting at 5s. Completed jobs kept for 100, failed for 500.
