import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { uploadBase64Image } from './storage';
export interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  username_changed_at: string | null;
  default_visibility: 'public' | 'friends' | 'private';
  phone: string;
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  username_changed_at: string | null;
  default_visibility: 'public' | 'friends' | 'private';
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
  created_at: string;
}

const PROFILE_SELECT = `
  SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id,
         u.username_changed_at, u.default_visibility, u.created_at,
         g.name AS home_gym_name,
         (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)::int AS following_count
  FROM users u
  LEFT JOIN gyms g ON g.id = u.home_gym_id
`;

export async function getMe(userId: string): Promise<AuthUser> {
  const { rows } = await pool.query<AuthUser>(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id,
            u.username_changed_at, u.default_visibility, u.phone, u.created_at,
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
  username?: string;
  display_name?: string;
  home_gym_id?: string | null;
  avatar_base64?: string;
  default_visibility?: 'public' | 'friends' | 'private';
}

const USERNAME_COOLDOWN_DAYS = 30;

export async function updateMe(userId: string, input: UpdateMeInput): Promise<AuthUser> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (input.username !== undefined) {
    const { rows: existing } = await pool.query(
      `SELECT id FROM users WHERE username = $1 AND id != $2`,
      [input.username, userId],
    );
    if (existing.length > 0) {
      throw new AppError('USERNAME_TAKEN', 'Username is already taken', 409);
    }

    const { rows: [me] } = await pool.query<{ username: string; username_changed_at: string | null }>(
      `SELECT username, username_changed_at FROM users WHERE id = $1`,
      [userId],
    );
    if (me && input.username !== me.username) {
      if (me.username_changed_at) {
        const changedAt = new Date(me.username_changed_at);
        const cooldownEnd = new Date(changedAt.getTime() + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        if (new Date() < cooldownEnd) {
          throw new AppError(
            'USERNAME_COOLDOWN',
            `You can only change your username once every ${USERNAME_COOLDOWN_DAYS} days. Try again after ${cooldownEnd.toISOString().split('T')[0]}.`,
            429,
          );
        }
      }
      sets.push(`username = $${idx++}`);
      vals.push(input.username);
      sets.push(`username_changed_at = NOW()`);
    }
  }

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
  if (input.default_visibility !== undefined) {
    sets.push(`default_visibility = $${idx++}`);
    vals.push(input.default_visibility);
  }

  if (sets.length === 0) throw new AppError('BAD_REQUEST', 'No fields provided to update', 400);

  vals.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

  return getMe(userId);
}
