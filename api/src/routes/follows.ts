import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as userService from '../services/userService';
import * as friendsService from '../services/friendsService';

export const followsRouter = Router();

const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /users/me/friends — followed users with recent activity status
// Must be declared before /:username routes so "me" isn't matched as a username
followsRouter.get('/me/friends', requireAuth, async (req, res, next) => {
  try {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(20) })
      .parse(req.query);
    const data = await friendsService.getFollowingWithActivity(req.user!.userId, limit);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /users/:username/follow
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

// DELETE /users/:username/follow
followsRouter.delete('/:username/follow', requireAuth, async (req, res, next) => {
  try {
    const target = await userService.getByUsername(req.params['username']!);
    const followerId = req.user!.userId;

    const { rowCount } = await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, target.id],
    );

    if (!rowCount || rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Not currently following this user', 404);
    }

    res.json({ following: false });
  } catch (err) {
    next(err);
  }
});

// GET /users/:username/followers
followsRouter.get('/:username/followers', async (req, res, next) => {
  try {
    const { cursor, limit } = paginationSchema.parse(req.query);
    const target = await userService.getByUsername(req.params['username']!);

    const params: unknown[] = [target.id, limit + 1];
    let cursorClause = '';

    if (cursor) {
      // cursor = follower's userId; look up when that follow was created
      cursorClause = `
        AND (
          f.created_at < (
            SELECT f2.created_at FROM follows f2
            WHERE f2.follower_id = $3 AND f2.following_id = $1
          )
          OR (
            f.created_at = (
              SELECT f2.created_at FROM follows f2
              WHERE f2.follower_id = $3 AND f2.following_id = $1
            )
            AND f.follower_id < $3
          )
        )
      `;
      params.push(cursor);
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.created_at,
              g.name AS home_gym_name,
              (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
              (SELECT COUNT(*)::int FROM follows WHERE follower_id  = u.id) AS following_count
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       LEFT JOIN gyms g ON g.id = u.home_gym_id
       WHERE f.following_id = $1
       ${cursorClause}
       ORDER BY f.created_at DESC, f.follower_id DESC
       LIMIT $2`,
      params,
    );

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    res.json({ data, cursor: nextCursor, has_more: hasMore });
  } catch (err) {
    next(err);
  }
});

// GET /users/:username/following
followsRouter.get('/:username/following', async (req, res, next) => {
  try {
    const { cursor, limit } = paginationSchema.parse(req.query);
    const target = await userService.getByUsername(req.params['username']!);

    const params: unknown[] = [target.id, limit + 1];
    let cursorClause = '';

    if (cursor) {
      // cursor = followed user's userId; look up when that follow was created
      cursorClause = `
        AND (
          f.created_at < (
            SELECT f2.created_at FROM follows f2
            WHERE f2.follower_id = $1 AND f2.following_id = $3
          )
          OR (
            f.created_at = (
              SELECT f2.created_at FROM follows f2
              WHERE f2.follower_id = $1 AND f2.following_id = $3
            )
            AND f.following_id < $3
          )
        )
      `;
      params.push(cursor);
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.home_gym_id, u.created_at,
              g.name AS home_gym_name,
              (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
              (SELECT COUNT(*)::int FROM follows WHERE follower_id  = u.id) AS following_count
       FROM follows f
       JOIN users u ON u.id = f.following_id
       LEFT JOIN gyms g ON g.id = u.home_gym_id
       WHERE f.follower_id = $1
       ${cursorClause}
       ORDER BY f.created_at DESC, f.following_id DESC
       LIMIT $2`,
      params,
    );

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    res.json({ data, cursor: nextCursor, has_more: hasMore });
  } catch (err) {
    next(err);
  }
});
