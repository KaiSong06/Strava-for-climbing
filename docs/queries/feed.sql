-- Personal feed query
-- Returns ascents from users that :viewer_id follows.
-- Visibility rules:
--   'public'  → always shown
--   'friends' → shown only if the ascent's author also follows the viewer (mutual follow)
--   'private' → never shown in anyone else's feed
--
-- Pagination: keyset on (logged_at DESC, id DESC). The cursor is an opaque
-- base64url token that encodes { id, sortKey } — the service decodes it into
-- two bound parameters ($cursor_sort, $cursor_id) before running the query,
-- so there's no subquery round-trip to resolve the cursor row's logged_at.
-- See api/src/lib/cursorPagination.ts for the encode/decode helpers.

SELECT
  a.id,
  a.logged_at,
  a.type,
  a.user_grade,
  a.rating,
  u.id           AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  p.id           AS problem_id,
  p.colour,
  p.consensus_grade,
  g.id           AS gym_id,
  g.name         AS gym_name
FROM ascents a
JOIN users    u ON u.id = a.user_id
JOIN problems p ON p.id = a.problem_id
JOIN gyms     g ON g.id = p.gym_id
WHERE a.user_id IN (
  -- only ascents from people the viewer follows
  SELECT following_id FROM follows WHERE follower_id = :viewer_id
)
AND (
  a.visibility = 'public'
  OR (
    -- friends-only: visible if the author follows the viewer back (mutual)
    a.visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM follows f2
      WHERE f2.follower_id = a.user_id
        AND f2.following_id = :viewer_id
    )
  )
)
-- cursor condition (omit for the first page)
AND (
  a.logged_at < :cursor_sort
  OR (a.logged_at = :cursor_sort AND a.id < :cursor_id)
)
ORDER BY a.logged_at DESC, a.id DESC
LIMIT :limit;


-- Gym feed query
-- Returns recent public ascents at a specific gym.
-- No auth required; only 'public' ascents are included.

SELECT
  a.id,
  a.logged_at,
  a.type,
  a.user_grade,
  a.rating,
  u.id           AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  p.id           AS problem_id,
  p.colour,
  p.consensus_grade,
  g.id           AS gym_id,
  g.name         AS gym_name
FROM ascents a
JOIN users    u ON u.id = a.user_id
JOIN problems p ON p.id = a.problem_id
JOIN gyms     g ON g.id = p.gym_id
WHERE p.gym_id = :gym_id
  AND a.visibility = 'public'
-- cursor condition (omit for the first page)
AND (
  a.logged_at < :cursor_sort
  OR (a.logged_at = :cursor_sort AND a.id < :cursor_id)
)
ORDER BY a.logged_at DESC, a.id DESC
LIMIT :limit;
