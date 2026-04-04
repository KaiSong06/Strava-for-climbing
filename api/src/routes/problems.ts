import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as problemService from '../services/problemService';

export const problemsRouter = Router();

// GET /problems/:problemId — full detail + ascent_summary + grade_distribution
problemsRouter.get('/:problemId', optionalAuth, async (req, res, next) => {
  try {
    const detail = await problemService.getProblemDetail(req.params['problemId']!);
    res.json({ problem: detail });
  } catch (err) {
    next(err);
  }
});

// GET /problems/:problemId/ascents — paginated, visibility-filtered
problemsRouter.get('/:problemId/ascents', optionalAuth, async (req, res, next) => {
  try {
    const { cursor, limit } = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);

    const { rows: problemCheck } = await pool.query(`SELECT id FROM problems WHERE id = $1`, [
      req.params['problemId'],
    ]);
    if (!problemCheck[0]) throw new AppError('NOT_FOUND', 'Problem not found', 404);

    const viewerId: string | null = req.user?.userId ?? null;
    const cursorClause = cursor
      ? `AND (a.logged_at, a.id::text) < (
          SELECT logged_at, id::text FROM ascents WHERE id = $4::uuid
        )`
      : '';

    // Visibility: always show public. Show friends if mutual follow. Always show own ascents.
    const visibilityClause = `
      AND (
        a.visibility = 'public'
        OR a.user_id = $3
        OR (
          a.visibility = 'friends'
          AND $3 IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM follows f1
            JOIN follows f2 ON f1.follower_id = $3 AND f1.following_id = a.user_id
                           AND f2.follower_id = a.user_id AND f2.following_id = $3
          )
        )
      )`;

    const params: unknown[] = [req.params['problemId'], limit + 1, viewerId];
    if (cursor) params.push(cursor);

    const { rows } = await pool.query<{
      id: string;
      type: string;
      user_grade: string | null;
      rating: number | null;
      notes: string | null;
      logged_at: string;
      user_id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    }>(
      `SELECT a.id, a.type, a.user_grade, a.rating, a.notes, a.logged_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM ascents a
       JOIN users u ON u.id = a.user_id
       WHERE a.problem_id = $1
         ${visibilityClause}
         ${cursorClause}
       ORDER BY a.logged_at DESC, a.id DESC
       LIMIT $2`,
      params,
    );

    const has_more = rows.length > limit;
    const data = has_more ? rows.slice(0, limit) : rows;
    const nextCursor = has_more && data.length > 0 ? data[data.length - 1]!.id : null;

    res.json({
      data: data.map((r) => ({
        id: r.id,
        type: r.type,
        user_grade: r.user_grade,
        rating: r.rating,
        notes: r.notes,
        logged_at: r.logged_at,
        user: {
          id: r.user_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
        },
      })),
      cursor: nextCursor,
      has_more,
    });
  } catch (err) {
    next(err);
  }
});

// POST /problems/:problemId/dispute — convenience alias for POST /uploads/:uploadId/dispute
// (the actual dispute creation lives in disputes.ts, this is just a helper redirect)
// Kept here for future use if we want to link disputes to problems directly.

// POST /problems/:problemId/report — intentionally not implemented; disputes go through uploads
problemsRouter.post('/:problemId/dispute', requireAuth, async (_req, _res, next) => {
  next(new AppError('NOT_SUPPORTED', 'Create disputes via POST /uploads/:uploadId/dispute', 400));
});
