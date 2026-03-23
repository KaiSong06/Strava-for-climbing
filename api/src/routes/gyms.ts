import { Router } from 'express';
import { z } from 'zod';
import * as gymService from '../services/gymService';

export const gymsRouter = Router();

// GET /gyms
gymsRouter.get('/', async (_req, res, next) => {
  try {
    const gyms = await gymService.listAll();
    res.json({ data: gyms });
  } catch (err) {
    next(err);
  }
});

// GET /gyms/:gymId — full detail + aggregate stats
gymsRouter.get('/:gymId', async (req, res, next) => {
  try {
    const gym = await gymService.getGymById(req.params['gymId']!);
    res.json({ gym });
  } catch (err) {
    next(err);
  }
});

// GET /gyms/:gymId/problems/retired — grouped by month (must be before /:gymId/problems to avoid route conflict)
gymsRouter.get('/:gymId/problems/retired', async (req, res, next) => {
  try {
    const groups = await gymService.getRetiredProblemsGrouped(req.params['gymId']!);
    res.json({ data: groups });
  } catch (err) {
    next(err);
  }
});

// GET /gyms/:gymId/problems?status=active|retired|all&cursor=&limit=
gymsRouter.get('/:gymId/problems', async (req, res, next) => {
  try {
    const query = z
      .object({
        status: z.enum(['active', 'retired', 'all']).default('active'),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);

    const result = await gymService.getGymProblems(
      req.params['gymId']!,
      query.status,
      query.cursor,
      query.limit,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});
