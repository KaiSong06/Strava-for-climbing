import { pool } from '../db/pool';

export interface FeedItem {
  id: string;
  logged_at: string;
  type: 'flash' | 'send' | 'attempt';
  user: { id: string; username: string; display_name: string; avatar_url: string | null };
  problem: {
    id: string;
    colour: string;
    consensus_grade: string | null;
    gym: { id: string; name: string };
  };
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  photo_urls: string[];
}

type FeedRow = {
  id: string;
  logged_at: string;
  type: string;
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  photo_urls: string[] | null;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  problem_id: string;
  colour: string;
  consensus_grade: string | null;
  gym_id: string;
  gym_name: string;
};

const FEED_COLS = `
  a.id,
  a.logged_at,
  a.type,
  a.user_grade,
  a.rating,
  a.notes,
  (SELECT upl.photo_urls FROM uploads upl
   WHERE upl.user_id = a.user_id AND upl.problem_id = a.problem_id
   AND upl.processing_status IN ('matched', 'complete', 'awaiting_confirmation')
   ORDER BY upl.created_at DESC LIMIT 1) AS photo_urls,
  u.id           AS user_id,
  u.username,
  u.display_name,
  u.avatar_url,
  p.id           AS problem_id,
  p.colour,
  p.consensus_grade,
  g.id           AS gym_id,
  g.name         AS gym_name
`;

const FEED_JOINS = `
  JOIN users    u ON u.id = a.user_id
  JOIN problems p ON p.id = a.problem_id
  JOIN gyms     g ON g.id = p.gym_id
`;

// Keyset pagination: cursor is an ascentId; we paginate by (logged_at DESC, id DESC)
function cursorClause(paramIdx: number): string {
  return `
    AND (
      a.logged_at < (SELECT a2.logged_at FROM ascents a2 WHERE a2.id = $${paramIdx})
      OR (
        a.logged_at = (SELECT a2.logged_at FROM ascents a2 WHERE a2.id = $${paramIdx})
        AND a.id < $${paramIdx}
      )
    )
  `;
}

function toFeedItem(row: FeedRow): FeedItem {
  return {
    id: row.id,
    logged_at: row.logged_at,
    type: row.type as FeedItem['type'],
    user_grade: row.user_grade,
    rating: row.rating,
    notes: row.notes,
    photo_urls: row.photo_urls ?? [],
    user: {
      id: row.user_id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
    problem: {
      id: row.problem_id,
      colour: row.colour,
      consensus_grade: row.consensus_grade,
      gym: { id: row.gym_id, name: row.gym_name },
    },
  };
}

function paginate(
  rows: FeedRow[],
  limit: number,
): { data: FeedItem[]; cursor: string | null; has_more: boolean } {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map(toFeedItem);
  return { data, cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore };
}

export async function getPersonalFeed(
  viewerId: string,
  cursor?: string,
  limit = 20,
): Promise<{ data: FeedItem[]; cursor: string | null; has_more: boolean }> {
  const params: unknown[] = [viewerId, limit + 1];
  const extra = cursor ? (params.push(cursor), cursorClause(3)) : '';

  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE a.user_id IN (
       SELECT following_id FROM follows WHERE follower_id = $1
     )
     AND (
       a.visibility = 'public'
       OR (
         a.visibility = 'friends'
         AND EXISTS (
           SELECT 1 FROM follows f2
           WHERE f2.follower_id = a.user_id AND f2.following_id = $1
         )
       )
     )
     ${extra}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );

  return paginate(rows, limit);
}

export async function getGymFeed(
  gymId: string,
  cursor?: string,
  limit = 20,
): Promise<{ data: FeedItem[]; cursor: string | null; has_more: boolean }> {
  const params: unknown[] = [gymId, limit + 1];
  const extra = cursor ? (params.push(cursor), cursorClause(3)) : '';

  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE p.gym_id = $1
     AND a.visibility = 'public'
     ${extra}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );

  return paginate(rows, limit);
}

export async function getDiscoverFeed(
  viewerId: string | undefined,
  cursor?: string,
  limit = 20,
): Promise<{ data: FeedItem[]; cursor: string | null; has_more: boolean }> {
  const params: unknown[] = [limit + 1];
  let whereExtra = '';

  if (viewerId) {
    params.push(viewerId);
    whereExtra = `AND a.user_id != $${params.length}`;
  }

  const cursorExtra = cursor
    ? (params.push(cursor), cursorClause(params.length))
    : '';

  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE a.visibility = 'public'
     ${whereExtra}
     ${cursorExtra}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $1`,
    params,
  );

  return paginate(rows, limit);
}

export async function getUserAscents(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit = 20,
): Promise<{ data: FeedItem[]; cursor: string | null; has_more: boolean }> {
  // Determine visibility: always public; friends-only if mutual follow; never private
  let visibilityClause = `a.visibility = 'public'`;
  if (viewerId && viewerId !== targetUserId) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM follows
       WHERE follower_id = $1 AND following_id = $2
         AND EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1)`,
      [viewerId, targetUserId],
    );
    if ((rowCount ?? 0) > 0) {
      visibilityClause = `a.visibility IN ('public', 'friends')`;
    }
  } else if (viewerId === targetUserId) {
    visibilityClause = `a.visibility IN ('public', 'friends')`;
  }

  const params: unknown[] = [targetUserId, limit + 1];
  const extra = cursor ? (params.push(cursor), cursorClause(3)) : '';

  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE a.user_id = $1
     AND ${visibilityClause}
     ${extra}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );

  return paginate(rows, limit);
}
