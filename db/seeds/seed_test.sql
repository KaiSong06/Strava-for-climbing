-- E2E test seed for the vision pipeline
-- Depends on: all migrations (001–007) having been applied first.
--
-- Creates:
--   1 gym, 1 verified test user (password: testpass123), 2 problems with
--   known hold_vectors that pair with the mock vision service responses.
--
-- Vector design (cosine similarities against mock service responses):
--   Red problem  ←→ mock red response:  cos = 1.00   → auto-match (≥ 0.92)
--   Blue problem ←→ mock blue response: cos ≈ 0.84   → awaiting_confirmation (0.75–0.91)
--   No green problems seeded            → score = 0   → new problem (< 0.75)

-- ── Helper: zero-pad an array to a 200-dim vector ──────────────────────────

CREATE OR REPLACE FUNCTION _pad_to_200(vals float8[]) RETURNS vector AS $$
BEGIN
  RETURN (
    SELECT ('[' || string_agg(v::text, ',') || ']')::vector(200)
    FROM unnest(
      vals || ARRAY(SELECT 0::float8 FROM generate_series(1, 200 - array_length(vals, 1)))
    ) AS v
  );
END;
$$ LANGUAGE plpgsql;

-- ── Gym ─────────────────────────────────────────────────────────────────────

INSERT INTO gyms (id, name, city, lat, lng, default_retirement_days) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Test Gym Alpha', 'San Francisco', 37.7749, -122.4194, 14)
ON CONFLICT (id) DO NOTHING;

-- ── Test user ───────────────────────────────────────────────────────────────
-- password: testpass123   (hashed via pgcrypto at insert time)
-- email_verified = true   so uploads work without Resend

INSERT INTO users (id, username, display_name, email, email_verified, home_gym_id, password_hash) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'test_climber',
    'Test Climber',
    'test@example.com',
    true,
    '11111111-0000-0000-0000-000000000001',
    crypt('testpass123', gen_salt('bf', 10))
  )
ON CONFLICT (id) DO NOTHING;

-- ── Red problem (auto-match scenario) ──────────────────────────────────────
-- 5 holds sorted top→bottom: (0.2,0.9) (0.3,0.7) (0.5,0.5) (0.7,0.3) (0.8,0.1)
-- The mock vision service returns this EXACT vector for colour #FF0000,
-- giving cosine similarity = 1.0 → auto-match.

INSERT INTO problems (id, gym_id, colour, hold_vector, status, consensus_grade, total_sends, first_upload_at) VALUES
  (
    '33333333-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    '#FF0000',
    _pad_to_200(ARRAY[0.2, 0.9, 0.3, 0.7, 0.5, 0.5, 0.7, 0.3, 0.8, 0.1]),
    'active',
    'V3',
    5,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ── Blue problem (awaiting_confirmation scenario) ──────────────────────────
-- 3 holds: (0.4,0.8) (0.5,0.5) (0.6,0.2)
-- The mock returns a 4-hold vector for #0000FF that partially overlaps:
--   mock  = [0.4, 0.8, 0.5, 0.5, 0.3, 0.3, 0.7, 0.1, 0…]
--   seed  = [0.4, 0.8, 0.5, 0.5, 0.6, 0.2, 0, 0, 0…]
-- Cosine similarity ≈ 0.84 → awaiting_confirmation.

INSERT INTO problems (id, gym_id, colour, hold_vector, status, consensus_grade, total_sends, first_upload_at) VALUES
  (
    '33333333-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000001',
    '#0000FF',
    _pad_to_200(ARRAY[0.4, 0.8, 0.5, 0.5, 0.6, 0.2]),
    'active',
    'V5',
    3,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- No green (#00FF00) problems seeded — that colour triggers the "new problem" path.

-- ── Cleanup ─────────────────────────────────────────────────────────────────

DROP FUNCTION _pad_to_200;
