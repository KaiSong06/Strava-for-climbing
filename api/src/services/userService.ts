import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { uploadBase64Image } from './storage';
import type { AuthUser } from './authService';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
}

const PROFILE_SELECT = `
  SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.created_at,
         g.name AS home_gym_name,
         (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)::int AS following_count
  FROM users u
  LEFT JOIN gyms g ON g.id = u.home_gym_id
`;

export async function getMe(userId: string): Promise<AuthUser> {
  const { rows } = await pool.query<AuthUser>(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.email, u.created_at,
            g.name AS home_gym_name,
            (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)::int AS following_count
     FROM users u
     LEFT JOIN gyms g ON g.id = u.home_gym_id
     WHERE u.id = $1`,
    [userId],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'User not found', 404);
  return rows[0];
}

export async function getByUsername(username: string): Promise<UserProfile> {
  const { rows } = await pool.query<UserProfile>(
    `${PROFILE_SELECT} WHERE u.username = $1`,
    [username],
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'User not found', 404);
  return rows[0];
}

interface UpdateMeInput {
  display_name?: string;
  home_gym_id?: string | null;
  avatar_base64?: string;
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<AuthUser> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (input.display_name !== undefined) {
    sets.push(`display_name = $${idx++}`);
    vals.push(input.display_name);
  }
  if (input.home_gym_id !== undefined) {
    sets.push(`home_gym_id = $${idx++}`);
    vals.push(input.home_gym_id);
  }
  if (input.avatar_base64) {
    const url = await uploadBase64Image(input.avatar_base64, 'avatars');
    sets.push(`avatar_url = $${idx++}`);
    vals.push(url);
  }

  if (sets.length === 0) throw new AppError('BAD_REQUEST', 'No fields provided to update', 400);

  vals.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

  return getMe(userId);
}
