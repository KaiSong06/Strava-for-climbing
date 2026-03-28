-- ─── Dev seed: gyms, users, problems, ascents, follows ────────────────────
-- Run via:  cd api && npm run db:seed
-- Safe to re-run: uses ON CONFLICT guards throughout.
-- NOTE: Seed users have no auth.users entries — to test auth, register through the app.

-- ─── Helper: pad a float array to 200-dim vector(200) ─────────────────────

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

-- ─── Gyms ──────────────────────────────────────────────────────────────────

INSERT INTO gyms (id, name, city, lat, lng, default_retirement_days) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Altitude Gym Kanata',   'Kanata',    45.2980, -75.9117, 14),
  ('11111111-0000-0000-0000-000000000002', 'Altitude Gym Gatineau', 'Gatineau',  45.4467, -75.7369, 14),
  ('11111111-0000-0000-0000-000000000003', 'Altitude Gym Orleans',  'Orleans',   45.4766, -75.5170, 14),
  ('11111111-0000-0000-0000-000000000004', 'Coyote Rock Gym',       'Ottawa',    45.4060, -75.6270, 14),
  ('11111111-0000-0000-0000-000000000005', 'Klimat Ottawa',         'Ottawa',    45.4015, -75.6972, 14),
  ('11111111-0000-0000-0000-000000000006', 'Klimat Wakefield',      'Wakefield', 45.6410, -75.9280, 14)
ON CONFLICT (id) DO NOTHING;

-- ─── Users ─────────────────────────────────────────────────────────────────
-- ON CONFLICT DO UPDATE so re-running the seed fixes placeholder hashes from
-- older versions of this file.

INSERT INTO users (id, username, display_name, phone, home_gym_id) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'alex_climbs', 'Alex Chen',
    '+15551000001',
    '11111111-0000-0000-0000-000000000004'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'sam_sends', 'Sam Torres',
    '+15551000002',
    '11111111-0000-0000-0000-000000000005'
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    'jordan_flash', 'Jordan Kim',
    '+15551000003',
    '11111111-0000-0000-0000-000000000001'
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    'maya_boulders', 'Maya Patel',
    '+15551000004',
    '11111111-0000-0000-0000-000000000006'
  ),
  (
    '22222222-0000-0000-0000-000000000005',
    'kai_dyno', 'Kai Rivera',
    '+15551000005',
    '11111111-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO UPDATE SET
  phone = EXCLUDED.phone;

-- ─── Problems ──────────────────────────────────────────────────────────────
-- hold_vector: (x,y) pairs sorted by y DESC (top hold first), zero-padded to 200 dims.
-- consensus_grade and total_sends are denormalised values; set to match the
-- ascents inserted below.

-- Altitude Gym Kanata ───────────────────────────────────────────────────────

INSERT INTO problems (id, gym_id, colour, hold_vector, status, consensus_grade, total_sends, first_upload_at) VALUES

  -- Red V3 — 6 holds
  ( '33333333-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001', '#ef4444',
    _pad_to_200(ARRAY[0.5,0.9, 0.3,0.75, 0.7,0.6, 0.4,0.4, 0.6,0.25, 0.5,0.1]::float8[]),
    'active', 'V3', 3, NOW() - INTERVAL '10 days' ),

  -- Blue V5 — 4 holds
  ( '33333333-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000001', '#3b82f6',
    _pad_to_200(ARRAY[0.4,0.85, 0.65,0.65, 0.3,0.45, 0.55,0.2]::float8[]),
    'active', 'V5', 2, NOW() - INTERVAL '8 days' ),

  -- Green V7 — 5 holds
  ( '33333333-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000001', '#22c55e',
    _pad_to_200(ARRAY[0.5,0.92, 0.6,0.7, 0.3,0.5, 0.7,0.3, 0.45,0.1]::float8[]),
    'active', 'V7', 1, NOW() - INTERVAL '7 days' ),

  -- Yellow V2 — 4 holds
  ( '33333333-0000-0000-0000-000000000004',
    '11111111-0000-0000-0000-000000000001', '#eab308',
    _pad_to_200(ARRAY[0.5,0.8, 0.4,0.6, 0.6,0.4, 0.5,0.15]::float8[]),
    'active', 'V2', 2, NOW() - INTERVAL '6 days' ),

  -- Purple V9 — 8 holds
  ( '33333333-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000001', '#a855f7',
    _pad_to_200(ARRAY[0.6,0.95, 0.3,0.8, 0.7,0.65, 0.2,0.5, 0.8,0.38, 0.4,0.28, 0.65,0.15, 0.5,0.05]::float8[]),
    'active', 'V9', 0, NOW() - INTERVAL '4 days' )

ON CONFLICT (id) DO NOTHING;

-- Altitude Gym Gatineau ─────────────────────────────────────────────────────

INSERT INTO problems (id, gym_id, colour, hold_vector, status, consensus_grade, total_sends, first_upload_at) VALUES

  -- Orange V4 — 5 holds
  ( '33333333-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000002', '#f97316',
    _pad_to_200(ARRAY[0.5,0.85, 0.3,0.65, 0.7,0.45, 0.4,0.28, 0.6,0.1]::float8[]),
    'active', 'V4', 3, NOW() - INTERVAL '9 days' ),

  -- Black V6 — 6 holds
  ( '33333333-0000-0000-0000-000000000007',
    '11111111-0000-0000-0000-000000000002', '#1f2937',
    _pad_to_200(ARRAY[0.4,0.9, 0.6,0.75, 0.3,0.6, 0.7,0.4, 0.5,0.22, 0.4,0.08]::float8[]),
    'active', 'V6', 1, NOW() - INTERVAL '7 days' ),

  -- Red V1 — 3 holds (beginner-friendly)
  ( '33333333-0000-0000-0000-000000000008',
    '11111111-0000-0000-0000-000000000002', '#ef4444',
    _pad_to_200(ARRAY[0.5,0.72, 0.4,0.42, 0.55,0.12]::float8[]),
    'active', 'V1', 2, NOW() - INTERVAL '5 days' )

ON CONFLICT (id) DO NOTHING;

-- Altitude Gym Orleans ──────────────────────────────────────────────────────

INSERT INTO problems (id, gym_id, colour, hold_vector, status, consensus_grade, total_sends, first_upload_at) VALUES

  -- Blue V8 — 7 holds
  ( '33333333-0000-0000-0000-000000000009',
    '11111111-0000-0000-0000-000000000003', '#3b82f6',
    _pad_to_200(ARRAY[0.3,0.9, 0.7,0.75, 0.5,0.6, 0.4,0.45, 0.65,0.32, 0.3,0.18, 0.5,0.05]::float8[]),
    'active', 'V8', 2, NOW() - INTERVAL '8 days' ),

  -- Green V4 — 4 holds
  ( '33333333-0000-0000-0000-000000000010',
    '11111111-0000-0000-0000-000000000003', '#22c55e',
    _pad_to_200(ARRAY[0.5,0.82, 0.35,0.55, 0.65,0.35, 0.5,0.12]::float8[]),
    'active', 'V4', 2, NOW() - INTERVAL '6 days' ),

  -- Red V3 — retired (set ~20 days ago, retired after 14 days)
  ( '33333333-0000-0000-0000-000000000011',
    '11111111-0000-0000-0000-000000000003', '#ef4444',
    _pad_to_200(ARRAY[0.4,0.78, 0.6,0.52, 0.35,0.3, 0.55,0.1]::float8[]),
    'retired', 'V3', 1, NOW() - INTERVAL '20 days' )

ON CONFLICT (id) DO NOTHING;

-- Set retired_at on the retired problem
UPDATE problems
SET retired_at = NOW() - INTERVAL '6 days'
WHERE id = '33333333-0000-0000-0000-000000000011'
  AND retired_at IS NULL;

-- ─── Ascents ───────────────────────────────────────────────────────────────
-- logged_at is staggered over the past week for realistic feed ordering.
-- Flash vs send is determined by whether a prior ascent exists for (user,problem);
-- since we're inserting directly we set the type explicitly.

INSERT INTO ascents (id, user_id, problem_id, type, user_grade, rating, visibility, logged_at) VALUES

  -- alex_climbs
  ( '44444444-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001',
    'flash', 'V3', 5, 'public',  NOW() - INTERVAL '7 days' ),
  ( '44444444-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002',
    'send',  'V5', 4, 'public',  NOW() - INTERVAL '5 days' ),
  ( '44444444-0000-0000-0000-000000000003',
    '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004',
    'flash', 'V2', 4, 'public',  NOW() - INTERVAL '3 days' ),
  ( '44444444-0000-0000-0000-000000000004',
    '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000006',
    'send',  'V4', 3, 'friends', NOW() - INTERVAL '1 day'  ),

  -- sam_sends
  ( '44444444-0000-0000-0000-000000000005',
    '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000006',
    'flash', 'V4', 5, 'public',  NOW() - INTERVAL '6 days' ),
  ( '44444444-0000-0000-0000-000000000006',
    '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000007',
    'send',  'V6', 4, 'public',  NOW() - INTERVAL '4 days' ),
  ( '44444444-0000-0000-0000-000000000007',
    '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000008',
    'flash', 'V1', 3, 'public',  NOW() - INTERVAL '2 days' ),
  ( '44444444-0000-0000-0000-000000000008',
    '22222222-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002',
    'attempt', NULL, NULL, 'public', NOW() - INTERVAL '6 hours' ),

  -- jordan_flash
  ( '44444444-0000-0000-0000-000000000009',
    '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001',
    'flash', 'V3', 5, 'public',  NOW() - INTERVAL '7 days' ),
  ( '44444444-0000-0000-0000-000000000010',
    '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003',
    'send',  'V7', 5, 'public',  NOW() - INTERVAL '5 days' ),
  ( '44444444-0000-0000-0000-000000000011',
    '22222222-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000009',
    'attempt', 'V8', NULL, 'public', NOW() - INTERVAL '2 days' ),

  -- maya_boulders
  ( '44444444-0000-0000-0000-000000000012',
    '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000009',
    'flash', 'V8', 5, 'public',  NOW() - INTERVAL '6 days' ),
  ( '44444444-0000-0000-0000-000000000013',
    '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000010',
    'send',  'V4', 4, 'public',  NOW() - INTERVAL '4 days' ),
  -- ascent on the retired problem (logged before it was retired)
  ( '44444444-0000-0000-0000-000000000014',
    '22222222-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000011',
    'send',  'V3', 3, 'private', NOW() - INTERVAL '18 days' ),

  -- kai_dyno
  ( '44444444-0000-0000-0000-000000000015',
    '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000004',
    'flash', 'V2', 4, 'public',  NOW() - INTERVAL '5 days' ),
  ( '44444444-0000-0000-0000-000000000016',
    '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000005',
    'attempt', NULL, NULL, 'public', NOW() - INTERVAL '3 days' ),
  ( '44444444-0000-0000-0000-000000000017',
    '22222222-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000006',
    'send',  'V4', 4, 'friends', NOW() - INTERVAL '1 day'  )

ON CONFLICT (id) DO NOTHING;

-- ─── Follows ───────────────────────────────────────────────────────────────

INSERT INTO follows (follower_id, following_id) VALUES
  -- alex follows sam, jordan, maya, kai
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003'),
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004'),
  ('22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005'),
  -- sam follows alex, jordan
  ('22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003'),
  -- jordan follows alex, sam, maya
  ('22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002'),
  ('22222222-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004'),
  -- maya follows jordan, kai
  ('22222222-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000003'),
  ('22222222-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000005'),
  -- kai follows alex, maya
  ('22222222-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ─── Cleanup ───────────────────────────────────────────────────────────────

DROP FUNCTION _pad_to_200;
