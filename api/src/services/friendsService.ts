import { pool } from '../db/pool';

export interface FriendWithActivity {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  has_new_activity: boolean;
}

export async function getFollowingWithActivity(
  userId: string,
  limit = 20,
): Promise<FriendWithActivity[]> {
  const { rows } = await pool.query<FriendWithActivity>(
    `SELECT
       u.id,
       u.username,
       u.display_name,
       u.avatar_url,
       EXISTS (
         SELECT 1 FROM ascents a
         WHERE a.user_id = u.id
         AND a.logged_at > NOW() - INTERVAL '24 hours'
       ) AS has_new_activity
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
     ORDER BY has_new_activity DESC, f.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return rows;
}
