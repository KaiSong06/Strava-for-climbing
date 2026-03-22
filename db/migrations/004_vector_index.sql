-- IVFFlat index for ANN cosine similarity search on hold vectors.
-- Always pre-filter by gym_id + colour before using this index (see idx_problems_gym_colour).
-- lists = 100 is appropriate for up to ~10k active problems per gym.
-- Requires pgvector extension (already enabled in 001_initial_schema.sql).
CREATE INDEX IF NOT EXISTS idx_problems_hold_vector
  ON problems USING ivfflat (hold_vector vector_cosine_ops)
  WITH (lists = 100);
