import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { supabaseAdmin } from '../lib/supabase';
import { pool } from '../db/pool';

export const authRouter = Router();

// POST /auth/delete-account — permanently deletes the user from public.users and Supabase auth
authRouter.post('/delete-account', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    // Delete from public tables first (cascade-safe order)
    await pool.query(`DELETE FROM push_tokens WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`, [userId]);
    await pool.query(`DELETE FROM ascents WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM uploads WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    // Then delete the Supabase auth user
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) throw error;

    res.json({ message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});
