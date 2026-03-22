# Crux — Strava for Bouldering

Social bouldering app for iOS and Android. Users log climbs, follow friends, and discover problems at their gym. Core differentiator: photo-based hold detection that auto-identifies and clusters problems using computer vision, so every ascent is automatically linked to the correct gym problem without manual entry.

---

## Stack

**Mobile**: React Native (Expo) — single codebase for iOS + Android
**Backend API**: Node.js + Express + TypeScript
**Database**: PostgreSQL with pgvector extension (similarity search)
**Object storage**: S3-compatible (photos, 3D models)
**Vision pipeline**: Python + FastAPI (separate service, async)
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
/docs            Specs, ADRs, data model diagrams
```

---

## Key commands

```bash
# Mobile
cd mobile && npx expo start

# API
cd api && npm run dev          # ts-node-dev, port 3001
cd api && npm run migrate      # run pending migrations
cd api && npm run test         # Jest

# Vision service
cd vision && uvicorn main:app --reload --port 8000

# Database
npm run db:migrate             # from /api
npm run db:seed                # seed gyms + test users
```

---

## Architecture rules

- Vision pipeline is **always async** — jobs are enqueued via BullMQ, never called synchronously from API routes. Mobile polls `/uploads/:id/status` or receives push notification on completion.
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
```

---

## Code style

- TypeScript strict mode everywhere in `/api` and `/mobile`. No `any`.
- Named exports only — no default exports except screen components in React Native.
- React Native: functional components with hooks. No class components.
- API routes: thin controllers, logic in service layer (`/services`). Never put business logic in route handlers.
- Errors: always throw typed errors from services, catch at controller level and return structured JSON `{ error: { code, message } }`.
- Never commit `.env` files. Use `.env.example` to document required vars.

---

## Gotchas

- pgvector ANN queries require the `vector` extension to be enabled: `CREATE EXTENSION IF NOT EXISTS vector;` — run this before migrations.
- The vision pipeline uses MiDaS for depth estimation and SAM ViT-B for segmentation. These models are heavy — do NOT run them in the API process. They belong in `/vision` only.
- Expo managed workflow — avoid bare React Native modules unless absolutely necessary. Check Expo SDK compatibility before adding native deps.
- `hold_vector` length varies per problem (2 floats per hold). pgvector requires fixed-dimension vectors — pad all vectors to a max dimension (e.g. 200 = 100 holds max) with zeros before storing.
- For matching, sort hold centroids by y-desc before vectorising so ordering is consistent across uploads of the same problem.

---

## Docs to reference

- Full product spec: `@docs/SPEC.md`
- Data model diagram: `@docs/data-model.md`
- Vision pipeline detail: `@docs/vision-pipeline.md`
- API endpoint list: `@docs/api-routes.md`