-- Migration 010: Schema hardening
-- (a) Partial index for the vision worker's active-uploads polling path.
-- (b) Dimension CHECK constraint on problems.hold_vector (enforces the
--     "always 200-dim, zero-padded" invariant at the database level).

-- ─── (a) Uploads polling partial index ───────────────────────────────────────
-- Supports status-filtered scans over in-flight uploads (pending, processing)
-- without bloating the index with the much larger set of terminal rows
-- (matched, unmatched, complete, awaiting_confirmation, failed). Ordered by
-- created_at so the worker / monitoring can pick up the oldest active row
-- first.
CREATE INDEX IF NOT EXISTS idx_uploads_processing_active
  ON uploads (created_at)
  WHERE processing_status IN ('pending', 'processing');

-- ─── (b) hold_vector dimension CHECK constraint ──────────────────────────────
-- pgvector's vector_dims() returns an integer. A NULL hold_vector is still
-- valid (problems can exist before a vector is computed). Wrapped in a DO
-- block because PostgreSQL doesn't support `IF NOT EXISTS` on named
-- constraints — the duplicate_object guard makes re-running this migration
-- safe.
DO $$
BEGIN
  ALTER TABLE problems
    ADD CONSTRAINT problems_hold_vector_dim_200
    CHECK (hold_vector IS NULL OR vector_dims(hold_vector) = 200);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
