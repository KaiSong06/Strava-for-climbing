import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ascentService from '../services/ascentService';

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
