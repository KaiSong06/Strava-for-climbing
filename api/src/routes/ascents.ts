import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import * as ascentService from '../services/ascentService';
import * as problemService from '../services/problemService';

export const ascentsRouter = Router();

// GET /ascents/:ascentId — returns ascent with joined problem + gym
ascentsRouter.get('/:ascentId', requireAuth, async (req, res, next) => {
  try {
    const ascent = await ascentService.getAscentById(req.params['ascentId']!);
    res.json(ascent);
  } catch (err) {
    next(err);
  }
});

// POST /ascents — log a climb directly on a known problem (skips the upload/camera flow)
ascentsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      problem_id: z.string().uuid(),
      user_grade: z.string().max(10).nullish().transform((v) => v ?? null),
      rating: z.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
      notes: z.string().max(280).nullish().transform((v) => v ?? null),
      visibility: z.enum(['public', 'friends', 'private']).default('public'),
    });
    const body = schema.parse(req.body);

    const { rows } = await pool.query(
      `SELECT id FROM problems WHERE id = $1`,
      [body.problem_id],
    );
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Problem not found', 404);

    const ascentId = await ascentService.createAscent(req.user!.userId, body.problem_id, {
      user_grade: body.user_grade,
      rating: body.rating,
      notes: body.notes,
      video_url: null,
      visibility: body.visibility,
    });

    await problemService.incrementTotalSends(body.problem_id);
    await problemService.calculateConsensusGrade(body.problem_id);

    res.status(201).json({ ascentId, problemId: body.problem_id });
  } catch (err) {
    next(err);
  }
});
