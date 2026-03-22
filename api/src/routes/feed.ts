import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import * as feedService from '../services/feedService';

export const feedRouter = Router();

const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /feed — personalized feed for the authenticated user
feedRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { cursor, limit } = paginationSchema.parse(req.query);
    const result = await feedService.getPersonalFeed(req.user!.userId, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /feed/gym/:gymId — recent public ascents at a specific gym
feedRouter.get('/gym/:gymId', async (req, res, next) => {
  try {
    const { cursor, limit } = paginationSchema.parse(req.query);
    const result = await feedService.getGymFeed(req.params['gymId']!, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
