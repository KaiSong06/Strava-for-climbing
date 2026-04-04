import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth';
import * as userService from '../services/userService';
import * as feedService from '../services/feedService';

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
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/)
    .optional(),
  display_name: z.string().min(1).max(50).optional(),
  home_gym_id: z.string().uuid().nullable().optional(),
  avatar_base64: z.string().optional(),
  default_visibility: z.enum(['public', 'friends', 'private']).optional(),
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

const ascentPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /users/:username/ascents — paginated ascents; visibility depends on viewer
usersRouter.get('/:username/ascents', optionalAuth, async (req, res, next) => {
  try {
    const { cursor, limit } = ascentPaginationSchema.parse(req.query);
    const target = await userService.getByUsername(req.params['username']!);
    const result = await feedService.getUserAscents(target.id, req.user?.userId, cursor, limit);
    res.json(result);
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
