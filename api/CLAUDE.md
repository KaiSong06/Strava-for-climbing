# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `api/` directory.

## Overview

Express + TypeScript backend API for Crux. Validates Supabase JWTs, serves REST endpoints, manages the vision job queue, and handles all business logic.

## Commands

```bash
npm run dev                    # ts-node-dev, port 3001
npm run worker:vision          # BullMQ vision worker (separate process)
npm run worker:retirement      # nightly retirement cron (02:00 UTC)
npm run build                  # tsc → dist/
npm run db:migrate             # apply pending migrations
npm run db:seed                # seed dev data
npx tsc --noEmit               # type-check without emitting
```

## Architecture

**Entry point:** `src/index.ts` — middleware chain: CORS → body parsing → default rate limiter → routes → Sentry error handler → global error handler.

**Layers:**
- `src/routes/` — thin controllers, Zod validation, delegates to services
- `src/services/` — business logic, raw SQL with parameterized queries (no ORM)
- `src/middleware/` — auth (Supabase JWT), error handling, rate limiting
- `src/jobs/` — BullMQ vision worker + retirement cron
- `src/lib/` — Sentry init, Supabase admin client singleton
- `src/db/pool.ts` — `pg` Pool singleton (max 5 connections, SSL by default)

**Route mounting** (`src/routes/index.ts`):
- `/auth` — only `POST /auth/delete-account`
- `/users` — profile CRUD + follows (followsRouter also mounts at `/users`)
- `/gyms`, `/feed`, `/uploads`, `/ascents`, `/problems`, `/disputes`, `/search`
- `/internal` — protected by `INTERNAL_SECRET` header (retirement trigger)
- `/push-tokens` — Expo push token registration

## Auth

API does NOT handle registration or login — Supabase Auth does that on mobile. The API only validates Supabase JWTs:
- `requireAuth` — rejects 401 if missing/invalid, attaches `req.user.userId` (from JWT `sub` claim)
- `optionalAuth` — attaches `req.user` if valid, never rejects
- No `requireVerified` — phone verification is implicit in Supabase Auth

JWT verification uses JWKS: `createRemoteJWKSet` from `jose` fetches keys from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Tokens are ES256 (asymmetric). Requires `SUPABASE_URL` env var (not a shared secret).

## Rate Limiting

- `defaultLimiter` — 100 req/min (global)
- `authLimiter` — 10 req/min (auth routes)
- `uploadLimiter` — 20 req/min (POST /uploads)

Apply the correct limiter when adding new routes.

## Error Handling

Throw `AppError(code, message, statusCode)` from services. The global error handler catches `AppError`, `ZodError` (→ 400), and unknown errors (→ 500 + Sentry). Response shape: `{ error: { code, message } }`.

## Vision Worker

`src/jobs/visionWorker.ts` — separate process, dequeues from BullMQ `'vision'` queue:
1. Calls `POST /process` on the Python vision service
2. Stores hold_vector on the upload row
3. Runs pgvector cosine similarity search (pre-filtered by gym_id + colour)
4. Updates upload status: `matched` (score >= 0.92), `awaiting_confirmation` (0.75–0.91), or `failed`
5. Sends push notification to user

Retries: 3 attempts, exponential backoff starting at 5s.

## Storage

`src/services/storage.ts` — dual backend:
- Default: Supabase Storage (via shared `lib/supabase.ts` admin client)
- Optional: S3/MinIO (set `STORAGE_BACKEND=s3`)
- Exports `uploadBase64Image()` and `uploadBuffer()` — never call backends directly

## TypeScript

- Shared contract types live in `shared/types.ts` and are imported via the `@shared/*` path alias. Never duplicate a type across api and mobile.
- Strict mode: no `any`, no unused locals/params, no implicit returns
