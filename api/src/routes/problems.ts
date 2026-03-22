import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';

export const problemsRouter = Router();

// GET /problems/:id — returns problem with its public ascents (for verifying Phase 4 end-to-end)
problemsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows: problemRows } = await pool.query<{
      id: string; gym_id: string; colour: string; status: string;
      consensus_grade: string | null; total_sends: number;
      first_upload_at: string; gym_name: string;
    }>(
      `SELECT p.id, p.gym_id, p.colour, p.status, p.consensus_grade, p.total_sends,
              p.first_upload_at, g.name AS gym_name
       FROM problems p JOIN gyms g ON g.id = p.gym_id
       WHERE p.id = $1`,
      [req.params['id']],
    );
    if (!problemRows[0]) throw new AppError('NOT_FOUND', 'Problem not found', 404);

    const { rows: ascentRows } = await pool.query<{
      id: string; type: string; user_grade: string | null;
      rating: number | null; visibility: string; logged_at: string;
      username: string; display_name: string;
    }>(
      `SELECT a.id, a.type, a.user_grade, a.rating, a.visibility, a.logged_at,
              u.username, u.display_name
       FROM ascents a JOIN users u ON u.id = a.user_id
       WHERE a.problem_id = $1
         AND a.visibility = 'public'
       ORDER BY a.logged_at DESC`,
      [req.params['id']],
    );

    res.json({ problem: problemRows[0], ascents: ascentRows });
  } catch (err) {
    next(err);
  }
});
