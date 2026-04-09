import { pool } from '../db/pool';
import type { FeedItem, PaginatedResponse } from '@shared/types';
import { buildKeysetClause, buildPaginationEnvelope } from '../lib/cursorPagination';

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

/** Build the ascents keyset clause — every feed variant paginates identically. */
function ascentsKeyset(cursor: string | undefined, startIndex: number) {
  return buildKeysetClause({ cursor, sortColumn: 'a.logged_at', idColumn: 'a.id', startIndex });
}

/** Wrap a row-set fetched with `LIMIT limit + 1` into a feed envelope. */
function buildFeedEnvelope(rows: FeedRow[], limit: number): PaginatedResponse<FeedItem> {
  const env = buildPaginationEnvelope({
    rows,
    limit,
    getCursorKey: (row) => ({ id: row.id, sortKey: row.logged_at }),
  });
  return { data: env.data.map(toFeedItem), cursor: env.cursor, has_more: env.has_more };
}

export async function getPersonalFeed(
  viewerId: string,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResponse<FeedItem>> {
  const params: unknown[] = [viewerId, limit + 1];
  const keyset = ascentsKeyset(cursor, params.length + 1);
  params.push(...keyset.params);
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
     ${keyset.sql}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );

  return buildFeedEnvelope(rows, limit);
}

export async function getGymFeed(
  gymId: string,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResponse<FeedItem>> {
  const params: unknown[] = [gymId, limit + 1];
  const keyset = ascentsKeyset(cursor, params.length + 1);
  params.push(...keyset.params);
  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE p.gym_id = $1
     AND a.visibility = 'public'
     ${keyset.sql}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );

  return buildFeedEnvelope(rows, limit);
}

export async function getDiscoverFeed(
  viewerId: string | undefined,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResponse<FeedItem>> {
  const params: unknown[] = [limit + 1];
  let viewerClause = '';
  if (viewerId) {
    params.push(viewerId);
    viewerClause = `AND a.user_id != $${params.length}`;
  }
  const keyset = ascentsKeyset(cursor, params.length + 1);
  params.push(...keyset.params);
  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE a.visibility = 'public'
     ${viewerClause}
     ${keyset.sql}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $1`,
    params,
  );

  return buildFeedEnvelope(rows, limit);
}

export async function getUserAscents(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit = 20,
): Promise<PaginatedResponse<FeedItem>> {
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
  const keyset = ascentsKeyset(cursor, params.length + 1);
  params.push(...keyset.params);
  const { rows } = await pool.query<FeedRow>(
    `SELECT ${FEED_COLS}
     FROM ascents a
     ${FEED_JOINS}
     WHERE a.user_id = $1
     AND ${visibilityClause}
     ${keyset.sql}
     ORDER BY a.logged_at DESC, a.id DESC
     LIMIT $2`,
    params,
  );
  return buildFeedEnvelope(rows, limit);
}
