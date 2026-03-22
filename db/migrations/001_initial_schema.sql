-- Enable pgvector extension (must run before any migration)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username          TEXT NOT NULL UNIQUE,
  display_name      TEXT NOT NULL,
  avatar_url        TEXT,
  home_gym_id       UUID,
  password_hash     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Gyms ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gyms (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  city                      TEXT NOT NULL,
  lat                       DOUBLE PRECISION NOT NULL,
  lng                       DOUBLE PRECISION NOT NULL,
  default_retirement_days   INT NOT NULL DEFAULT 14,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK now that gyms table exists
ALTER TABLE users ADD CONSTRAINT fk_users_home_gym
  FOREIGN KEY (home_gym_id) REFERENCES gyms(id) ON DELETE SET NULL;

-- ─── Problems ─────────────────────────────────────────────────────────────────

CREATE TYPE problem_status AS ENUM ('active', 'retired');

CREATE TABLE IF NOT EXISTS problems (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id            UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  colour            TEXT NOT NULL,
  -- Fixed 200-dim vector (2 floats per hold × 100 holds max), zero-padded
  hold_vector       vector(200),
  model_url         TEXT,
  status            problem_status NOT NULL DEFAULT 'active',
  consensus_grade   TEXT,
  total_sends       INT NOT NULL DEFAULT 0,
  first_upload_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_gym_id  ON problems(gym_id);
CREATE INDEX IF NOT EXISTS idx_problems_colour  ON problems(colour);
-- Combined index for the pre-filter used before ANN search
CREATE INDEX IF NOT EXISTS idx_problems_gym_colour ON problems(gym_id, colour);

-- ─── Ascents ──────────────────────────────────────────────────────────────────

CREATE TYPE ascent_type AS ENUM ('flash', 'send', 'attempt');
CREATE TYPE ascent_visibility AS ENUM ('public', 'friends', 'private');

CREATE TABLE IF NOT EXISTS ascents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  type        ascent_type NOT NULL,
  user_grade  TEXT,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  visibility  ascent_visibility NOT NULL DEFAULT 'public',
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ascents_user_problem ON ascents(user_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_ascents_problem_id   ON ascents(problem_id);

-- ─── Uploads ──────────────────────────────────────────────────────────────────

CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'matched', 'unmatched', 'failed');

CREATE TABLE IF NOT EXISTS uploads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id          UUID REFERENCES problems(id) ON DELETE SET NULL,
  photo_urls          TEXT[] NOT NULL DEFAULT '{}',
  processing_status   processing_status NOT NULL DEFAULT 'pending',
  similarity_score    DOUBLE PRECISION,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_user_id    ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_problem_id ON uploads(problem_id);

-- ─── Follows ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS follows (
  follower_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- ─── Match Disputes ───────────────────────────────────────────────────────────

CREATE TYPE dispute_status AS ENUM ('open', 'resolved_confirm', 'resolved_split');

CREATE TABLE IF NOT EXISTS match_disputes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id     UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  reported_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        dispute_status NOT NULL DEFAULT 'open',
  votes_confirm INT NOT NULL DEFAULT 0,
  votes_split   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_disputes_upload_id ON match_disputes(upload_id);
