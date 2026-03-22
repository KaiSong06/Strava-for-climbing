-- Seed: 3 gyms + 2 test users
-- Run after 001_initial_schema.sql

-- ─── Gyms ─────────────────────────────────────────────────────────────────────

INSERT INTO gyms (id, name, city, lat, lng, default_retirement_days) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Movement SOMA',         'San Francisco', 37.7749,  -122.4194, 14),
  ('11111111-0000-0000-0000-000000000002', 'Dogpatch Boulders',     'San Francisco', 37.7600,  -122.3877, 21),
  ('11111111-0000-0000-0000-000000000003', 'Brooklyn Boulders DUMBO','Brooklyn',     40.7033,  -73.9893,  14)
ON CONFLICT (id) DO NOTHING;

-- ─── Test Users ───────────────────────────────────────────────────────────────
-- password_hash is bcrypt of 'password123' (cost 10) — for dev only

INSERT INTO users (id, username, display_name, avatar_url, home_gym_id, password_hash) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    'alex_climbs',
    'Alex Chen',
    NULL,
    '11111111-0000-0000-0000-000000000001',
    '$2b$10$YourHashHere.ReplaceWithRealBcryptHashForDev'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'sam_sends',
    'Sam Torres',
    NULL,
    '11111111-0000-0000-0000-000000000002',
    '$2b$10$YourHashHere.ReplaceWithRealBcryptHashForDev'
  )
ON CONFLICT (id) DO NOTHING;
