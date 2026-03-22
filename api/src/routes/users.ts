import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import * as userService from '../services/userService';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await userService.getMe(req.user!.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

const patchMeSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  home_gym_id: z.string().uuid().nullable().optional(),
  avatar_base64: z.string().optional(),
});

usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const body = patchMeSchema.parse(req.body);
    const profile = await userService.updateMe(req.user!.userId, body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// Public profile — no auth required
usersRouter.get('/:username', async (req, res, next) => {
  try {
    const profile = await userService.getByUsername(req.params['username']!);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});
