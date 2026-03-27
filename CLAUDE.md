# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Crux — Strava for Bouldering

Social bouldering app for iOS and Android. Users log climbs, follow friends, and discover problems at their gym. Core differentiator: photo-based hold detection that auto-identifies and clusters problems using computer vision, so every ascent is automatically linked to the correct gym problem without manual entry.

---

## Stack

**Mobile**: React Native (Expo) — single codebase for iOS + Android
**Backend API**: Node.js + Express + TypeScript
**Database**: Supabase PostgreSQL (hosted) with pgvector extension (similarity search)
**Object storage**: Supabase Storage (photos, 3D models)
**Vision pipeline**: Python + FastAPI (separate service, async) — pipeline stages implemented; depth estimation (Stage 6 / MiDaS) is TODO/skipped for MVP
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
cd api && npm run worker:vision        # run vision BullMQ worker (separate process)
cd api && npm run worker:retirement   # run nightly retirement cron (schedules at 02:00 UTC)
cd api && npm test                 # Jest (all tests — no test files written yet)
cd api && npx jest --testPathPattern=<pattern>   # run a single test file

# Vision service (models load at startup — allow ~10s cold start)
cd vision && uvicorn main:app --reload --port 8000
# Note: no separate Python worker process — the TypeScript BullMQ worker calls POST /process

# Database
cd api && npm run db:migrate   # run pending migrations
cd api && npm run db:seed      # seed gyms + test users
cd api && npm run build        # tsc → dist/ (production)

# Docker Compose (full stack: redis, api, vision, vision-worker)
docker compose up              # requires api/.env and vision/.env

# E2E test environment (Postgres, Redis, MinIO, mock vision — no ML models needed)
docker compose -f docker-compose.test.yml up --build
# Test scenarios via helper scripts (no photos required):
./test/enqueue-test-job.sh red    # auto-match (score ≥ 0.92)
./test/enqueue-test-job.sh blue   # awaiting_confirmation (0.75–0.91)
./test/enqueue-test-job.sh green  # new problem (< 0.75)
# Test env ports: Postgres 5433, Redis 6380, MinIO 9000 (console 9001), mock vision 8001, API 3001
# Test user: test@example.com / testpass123 (pre-verified), gym_id: 11111111-0000-0000-0000-000000000001
```

---

## Required environment variables

**API** (`api/.env`):
- `DATABASE_URL` — Supabase PostgreSQL connection string (use the pooler URL from Supabase dashboard, port 6543)
- `REDIS_URL` — Redis connection string (e.g. `redis://localhost:6379`)
- `JWT_SECRET` — secret for signing access tokens
- `SUPABASE_URL` — Supabase project URL (e.g. `https://[project-ref].supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (from dashboard → Settings → API)
- `INTERNAL_SECRET` — shared secret used by vision worker when POSTing results back to the API
- `PORT` — defaults to `3001`
- `VISION_SERVICE_URL` — base URL of the Python vision service (e.g. `http://localhost:8000`); required by the BullMQ worker
- `CORS_ORIGIN` — comma-separated allowed origins (optional; if unset, CORS allows all origins)
- `RESEND_API_KEY` — API key for Resend email service (used for verification and password reset emails)
- `EMAIL_FROM` — sender address (e.g. `Crux <noreply@crux.app>`)
- `FRONTEND_URL` — used to build reset/verify links in emails (e.g. `http://localhost:3001`)
- `SENTRY_DSN` — Sentry DSN for error tracking (optional)
- `DB_SSL` — set to `"false"` to disable SSL for local/test Postgres (production uses SSL by default)
- `STORAGE_BACKEND` — set to `s3` to use S3/MinIO instead of Supabase Storage (used in test env)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`, `S3_REGION` — required when `STORAGE_BACKEND=s3`

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
- Feed pagination is **keyset-based** (not offset). Cursor is an ascent ID; the query uses a subquery to look up `logged_at` and paginates by `(logged_at DESC, id DESC)`. Reference SQL is in `docs/queries/feed.sql`.
- Rate limiting: three tiers — `defaultLimiter` (100/min, applied globally), `authLimiter` (10/min, auth routes), `uploadLimiter` (20/min, POST /uploads). Apply the correct limiter when adding new routes.
- Sentry error tracking is configured in `api/src/lib/sentry.ts`. The Sentry error handler must be registered **after** routes but **before** the global `errorHandler` middleware (see `api/src/index.ts`).

---

## Data model (key tables)

```
users           id, username, display_name, avatar_url, home_gym_id
gyms            id, name, city, lat, lng, default_retirement_days
problems        id, gym_id, colour, hold_vector, model_url, status, consensus_grade, first_upload_at, retired_at
ascents         id, user_id, problem_id, type (flash|send|attempt), user_grade, rating, visibility, logged_at
uploads         id, user_id, problem_id, photo_urls[], processing_status (pending|processing|awaiting_confirmation|complete|matched|unmatched|failed), similarity_score
follows         follower_id, following_id
match_disputes  id, upload_id, reported_by, status, votes_confirm, votes_split
refresh_tokens  id, user_id, token_hash (indexed), expires_at
```

Key shared types beyond the tables: `FeedItem` (ascent + problem + user + gym aggregated for feed display), `PaginatedResponse<T>` (data[], cursor, has_more), `UserProfile` (User + follower/following counts + home_gym_name).

---

## Code style

- TypeScript strict mode everywhere in `/api` and `/mobile`. No `any`. Also enforces `noUnusedLocals`, `noUnusedParameters`, and `noImplicitReturns` — remove unused variables/params rather than prefixing with `_`.
- Named exports only — no default exports except screen components in React Native.
- React Native: functional components with hooks. No class components.
- API routes: thin controllers, logic in service layer (`/services`). Never put business logic in route handlers.
- Input validation: use Zod in route handlers before calling services. The global `errorHandler` also catches `ZodError` and returns a 400.
- Three auth middlewares: `requireAuth` (rejects 401 if no/invalid token, attaches `req.user`) and `optionalAuth` (attaches `req.user` if valid token, never rejects — for public routes where auth enriches but isn't required) are in `api/src/middleware/auth.ts`. `requireVerified` (`api/src/middleware/requireVerified.ts`) — apply after `requireAuth` on routes that require email verification; returns 403 `EMAIL_NOT_VERIFIED` if not verified. Import and apply per-route, not globally.
- Errors: throw `AppError` (from `api/src/middleware/errorHandler.ts`) in services; the global `errorHandler` middleware catches it and returns `{ error: { code, message } }`.
- Email delivery uses Resend SDK (`api/src/services/emailService.ts`). Push notifications use Expo SDK (`api/src/services/pushService.ts`).
- Never commit `.env` files. Use `.env.example` to document required vars.

---

## Mobile-specific patterns

- **Routing**: Expo Router (file-based). Screens live in `mobile/app/`. The `@/` path alias maps to the `mobile/` root.
- **Server state**: TanStack React Query — use for all API calls.
- **Client state**: Zustand — use for global UI/auth state.
- **API client**: `mobile/src/lib/api.ts` exports `api.get/post/patch/delete`. Always use this instead of raw `fetch`. It reads `EXPO_PUBLIC_API_URL`, auto-attaches the Bearer token, handles 401s by refreshing the token (deduplicating concurrent refresh attempts), and throws `ApiError` on non-2xx responses.
- **Auth store**: `mobile/src/stores/authStore.ts` — Zustand store persisted to `SecureStore`. Check `_hasHydrated` before reading auth state (the root layout gates navigation on this).
- **Follow store**: `mobile/src/stores/followStore.ts` — Zustand store for follow state.
- **Theme**: `mobile/src/theme/colors.ts` exports the "Midnight Editorial" design token object (`colors`). Always import color values from here — never hardcode hex strings in component stylesheets.
- **Components**: `mobile/src/components/` — `FeedCard` (renders a single feed item), `FollowButton` (follow/unfollow toggle), `ProblemCard` (problem summary card), `TabBar` (custom bottom bar with FAB for the record tab; also exports `TAB_BAR_HEIGHT = 72` used by `_layout.tsx` for `sceneStyle.paddingBottom`).
- **Screen organisation**: Simple screens are a single file at `mobile/src/screens/<Name>Screen.tsx`. Complex screens use a folder: `mobile/src/screens/<Name>/` containing `<Name>Screen.tsx` and a `components/` subfolder for sub-components. Tab route files (e.g. `mobile/app/(tabs)/account.tsx`) are thin re-exports: `export { default } from '@/src/screens/Account/AccountScreen'`.
- **Hooks**: `mobile/src/hooks/useVisionPipeline.ts` and `useMatchResult.ts` — **stubs only**; simulate delays but do not call the real API yet (TODO: wire to upload endpoint and match result polling).
- **Tab screens**: `(tabs)/index.tsx` = feed, `record.tsx` = upload/log a climb, `search.tsx` = search, `gym.tsx` = gym browse, `account.tsx` = user profile. Auth screens: `(auth)/login.tsx`, `(auth)/register.tsx`.
- **Upload service**: `mobile/src/services/uploadService.ts` — handles photo selection and multipart upload to the API.
- **Shared types**: Import from `shared/types.ts` (not a published package; reference by relative path or configure the path in tsconfig).
- **Account screen**: Recent activity is currently mocked (`MOCK_ACTIVITIES` in `AccountScreen.tsx`). TODO: replace with a real query to the ascents endpoint once it's wired.

## UI References

`UI_References/` contains HTML mockups and design notes for key screens (currently `Crux_Account/` and `Crux_Home/`). These are design specs only — not production code. Reference them when implementing or restyling a screen.

---

## Gotchas

- pgvector ANN queries require the `vector` extension to be enabled: `CREATE EXTENSION IF NOT EXISTS vector;` — this is included in `db/migrations/001_initial_schema.sql` but must exist before migrations run.
- The vision pipeline uses SAM ViT-B for segmentation and MiDaS small for depth estimation (depth is TODO/skipped for MVP). Models are heavy — do NOT run them in the API process. They belong in `/vision` only. Models load **at startup** via the FastAPI `lifespan` hook (cold start ~10s). Before running the vision service, download model weights into `vision/models/`: `curl -L -o vision/models/sam_vit_b_01ec64.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth` (~375 MB). MiDaS is auto-cached by `torch.hub` on first run.
- Expo managed workflow — avoid bare React Native modules unless absolutely necessary. Check Expo SDK compatibility before adding native deps.
- `hold_vector` length varies per problem (2 floats per hold). pgvector requires fixed-dimension vectors — pad all vectors to 200 dims (100 holds max, `vector(200)`) with zeros before storing.
- For matching, sort hold centroids by y-desc before vectorising so ordering is consistent across uploads of the same problem.
- BullMQ job retries: 3 attempts, exponential backoff starting at 5s. Completed jobs kept for 100, failed for 500.
- `calculateConsensusGrade` is called after every ascent is logged (via POST /uploads/:id/confirm and POST /ascents). It sorts all non-null user_grade values by V-number and takes the median.
- Retirement runs nightly (02:00 UTC) via `npm run worker:retirement` or via POST /internal/run-retirement (protected by `INTERNAL_SECRET` header). Both call the same `runRetirement()` function.
- Dispute creation: POST /uploads/:uploadId/dispute. Voting: POST /disputes/:disputeId/vote. Resolution requires ≥ 3 total votes with a majority. 'split' resolution creates a new problem and reassigns the upload.
- Search: GET /search?q=&type=user|gym|all. Minimum 2 chars. Returns up to 5 users + 5 gyms, exact matches first.
- The pgvector IVFFlat index (`idx_problems_hold_vector`, migration 004) uses `lists = 100`, tuned for up to ~10k active problems per gym. Pre-filtering by `gym_id + colour` (via `idx_problems_gym_colour`) is required before ANN queries to keep the index effective.
- The `followsRouter` is mounted at `/users` (not `/follows`) — follow/unfollow endpoints live under `/users/:id/follow` etc. See `api/src/routes/index.ts`.
- Docker Compose runs 4 services: `redis`, `api`, `vision`, and `vision-worker` (a separate container from the same API image that only runs the BullMQ worker). The vision-worker depends on both redis and vision.
- JWT access tokens expire in 15 minutes; refresh tokens expire in 30 days and are stored as bcrypt hashes in the `refresh_tokens` table. bcrypt uses 12 salt rounds.
- Storage backend is toggled by `STORAGE_BACKEND=s3` env var. Default is Supabase Storage. When `s3`, the service uses `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`. The test environment always uses S3 (MinIO). Both backends expose `uploadBase64Image` and `uploadBuffer` from `api/src/services/storage.ts` — never call storage backends directly.
- Email verification tokens (migration 007) and password reset tokens (migration 005) are stored as SHA256 hashes, never raw. Both are one-time use (`used_at`), with 24-hour and 1-hour expiry respectively. Password reset atomically invalidates all refresh tokens for the user.
- The data model has three new tables not listed above: `password_reset_tokens`, `email_verification_tokens` (both with `token_hash`, `expires_at`, `used_at`), and `push_tokens` (Expo push token per user, unique constraint).
- The vision service is deployed to Fly.io (`vision/fly.toml`) in the `yyz` region, 2 CPUs / 4 GB RAM, min 0 machines (scales to zero). The API is hosted separately.
