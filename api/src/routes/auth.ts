import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { supabaseAdmin } from '../lib/supabase';

export const authRouter = Router();

// POST /auth/delete-account — permanently deletes the Supabase auth user
authRouter.post('/delete-account', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(req.user!.userId);
    if (error) throw error;
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});
