# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `db/` directory.

## Overview

PostgreSQL migrations and seed scripts for the Crux database. Hosted on Supabase PostgreSQL with pgvector extension.

## Commands

```bash
cd ../api && npm run db:migrate    # apply pending migrations
cd ../api && npm run db:seed       # seed dev data (safe to re-run)
```

## Migrations

Sequential numbering: `migrations/NNN_description.sql`. Applied in alphabetical order.

| # | File | What it does |
|---|------|-------------|
| 001 | initial_schema | Core tables (users, gyms, problems, ascents, uploads, follows, match_disputes), pgvector + pgcrypto extensions |
| 002 | refresh_tokens | Adds email to users, creates refresh_tokens table (legacy, dropped in 008) |
| 003 | uploads_and_ascents | Extends uploads with gym_id, colour, hold_vector; adds notes/video_url to ascents |
| 004 | vector_index | IVFFlat ANN index on problems.hold_vector (lists=100, cosine ops) |
| 005 | password_reset_tokens | Creates password_reset_tokens (legacy, dropped in 008) |
| 006 | push_tokens | Creates push_tokens table for Expo push notifications |
| 007 | email_verification | Adds email_verified to users, creates email_verification_tokens (legacy, dropped in 008) |
| 008 | supabase_auth | Adds phone column, drops password_hash/email/email_verified columns, drops refresh_tokens/email_verification_tokens/password_reset_tokens tables |
| 009 | edit_profile | Adds username_changed_at column, indexes |

## Seeds

- `seeds/seed.sql` — dev data: 3 gyms, 5 users (with phone numbers), 11 problems (including 1 retired), 17 ascents, follow graph. Uses `ON CONFLICT` guards for safe re-runs. Seed users have no `auth.users` entries — register through the app to test auth.
- `seeds/seed_test.sql` — E2E test data: 1 gym, 1 user, 2 problems with precise hold_vectors designed for mock vision service responses (red=auto-match, blue=confirm, green=new).

## Key Schema Details

- **hold_vector**: `vector(200)` — up to 100 holds x (x, y) coordinates, zero-padded. Sort centroids by y DESC before vectorising.
- **pgvector ANN**: Always pre-filter by `gym_id + colour` before cosine similarity search. The IVFFlat index (migration 004) has `lists=100`.
- **Supabase Auth trigger**: A `handle_new_user()` trigger on `auth.users` auto-inserts into `public.users` — this must be created via Supabase SQL Editor (not through migrations, since it references the `auth` schema).
- **Phone numbers**: Stored in E.164 format (e.g., `+15551000001`). UNIQUE constraint.
