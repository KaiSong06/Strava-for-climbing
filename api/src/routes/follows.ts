import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as userService from '../services/userService';
import * as friendsService from '../services/friendsService';
import { buildKeysetClause, buildPaginationEnvelope } from '../lib/cursorPagination';

export const followsRouter = Router();

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /users/me/friends — must be declared before /:username so "me" isn't matched as a username.
followsRouter.get('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
      .parse(req.query);
    res.json({ data: await friendsService.getFollowingWithActivity(req.user!.userId, limit) });
  } catch (err) {
    next(err);
  }
});

followsRouter.post('/:username/follow', requireAuth, async (req, res, next) => {
  try {
    const target = await userService.getByUsername(req.params['username']!);
    const followerId = req.user!.userId;
    if (followerId === target.id) {
      throw new AppError('BAD_REQUEST', 'You cannot follow yourself', 400);
    }
    try {
      await pool.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)', [
        followerId,
        target.id,
      ]);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        throw new AppError('CONFLICT', 'Already following this user', 409);
      }
      throw err;
    }
    res.status(201).json({ following: true });
  } catch (err) {
    next(err);
  }
});

followsRouter.delete('/:username/follow', requireAuth, async (req, res, next) => {
  try {
    const target = await userService.getByUsername(req.params['username']!);
    const { rowCount } = await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user!.userId, target.id],
    );
    if (!rowCount) throw new AppError('NOT_FOUND', 'Not currently following this user', 404);
    res.json({ following: false });
  } catch (err) {
    next(err);
  }
});

interface FollowRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_gym_id: string | null;
  created_at: string;
  home_gym_name: string | null;
  follower_count: number;
  following_count: number;
  sort_at: string;
}
type FollowUser = Omit<FollowRow, 'sort_at'>;

// Shared handler for the mirror-image follow-list routes. Only the fixed/join
// columns of `follows` differ between `followers` and `following`.
function listFollowsHandler(mode: 'followers' | 'following') {
  const joinCol = mode === 'followers' ? 'f.follower_id' : 'f.following_id';
  const fixedCol = mode === 'followers' ? 'f.following_id' : 'f.follower_id';
  const sql = `
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.created_at,
           g.name AS home_gym_name,
           (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
           (SELECT COUNT(*)::int FROM follows WHERE follower_id  = u.id) AS following_count,
           f.created_at AS sort_at
    FROM follows f
    JOIN users u ON u.id = ${joinCol}
    LEFT JOIN gyms g ON g.id = u.home_gym_id
    WHERE ${fixedCol} = $1`;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cursor, limit } = paginationSchema.parse(req.query);
      const target = await userService.getByUsername(req.params['username']!);
      const params: unknown[] = [target.id, limit + 1];
      const keyset = buildKeysetClause({ cursor, sortColumn: 'f.created_at', idColumn: joinCol, startIndex: 3 });
      params.push(...keyset.params);
      const { rows } = await pool.query<FollowRow>(
        `${sql} ${keyset.sql} ORDER BY f.created_at DESC, ${joinCol} DESC LIMIT $2`,
        params,
      );
      const env = buildPaginationEnvelope({ rows, limit, getCursorKey: (r) => ({ id: r.id, sortKey: r.sort_at }) });
      const data: FollowUser[] = env.data.map(({ sort_at: _s, ...user }) => user);
      res.json({ data, cursor: env.cursor, has_more: env.has_more });
    } catch (err) {
      next(err);
    }
  };
}

followsRouter.get('/:username/followers', listFollowsHandler('followers'));
followsRouter.get('/:username/following', listFollowsHandler('following'));
