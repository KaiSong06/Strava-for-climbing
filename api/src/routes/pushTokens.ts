import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import * as pushService from '../services/pushService';

export const pushTokensRouter = Router();

const tokenSchema = z.object({ token: z.string().min(1) });

pushTokensRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    await pushService.registerToken(req.user!.userId, token);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

pushTokensRouter.delete('/', requireAuth, async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.query);
    await pushService.removeToken(token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
