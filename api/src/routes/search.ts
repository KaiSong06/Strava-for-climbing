import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';

export const searchRouter = Router();

interface UserResult {
  type: 'user';
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface GymResult {
  type: 'gym';
  id: string;
  name: string;
  city: string;
}

// GET /search?q=<query>&type=user|gym|all
searchRouter.get('/', async (req, res, next) => {
  try {
    const { q, type } = z
      .object({
        q: z.string().min(2, 'Query must be at least 2 characters'),
        type: z.enum(['user', 'gym', 'all']).default('all'),
      })
      .parse(req.query);

    const results: (UserResult | GymResult)[] = [];
    const pattern = `%${q}%`;

    if (type === 'user' || type === 'all') {
      const { rows } = await pool.query<Omit<UserResult, 'type'>>(
        `SELECT id, username, display_name, avatar_url
         FROM users
         WHERE username ILIKE $1 OR display_name ILIKE $1
         ORDER BY
           (LOWER(username) = LOWER($2) OR LOWER(display_name) = LOWER($2)) DESC,
           username ASC
         LIMIT 5`,
        [pattern, q],
      );
      results.push(...rows.map((r) => ({ type: 'user' as const, ...r })));
    }

    if (type === 'gym' || type === 'all') {
      const { rows } = await pool.query<Omit<GymResult, 'type'>>(
        `SELECT id, name, city
         FROM gyms
         WHERE name ILIKE $1 OR city ILIKE $1
         ORDER BY
           (LOWER(name) = LOWER($2)) DESC,
           name ASC
         LIMIT 5`,
        [pattern, q],
      );
      results.push(...rows.map((r) => ({ type: 'gym' as const, ...r })));
    }

    res.json({ data: results, query: q });
  } catch (err) {
    next(err);
  }
});
