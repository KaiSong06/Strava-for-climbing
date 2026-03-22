import { pool } from '../db/pool';

export async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM follows
     WHERE follower_id = $1 AND following_id = $2
       AND EXISTS (
         SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1
       )`,
    [userA, userB],
  );
  return (rowCount ?? 0) > 0;
}

export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const { rows } = await pool.query<{ followers: number; following: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS followers,
       (SELECT COUNT(*)::int FROM follows WHERE follower_id  = $1) AS following`,
    [userId],
  );
  return rows[0]!;
}
