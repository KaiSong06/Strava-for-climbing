import { Router } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService';
import * as passwordResetService from '../services/passwordResetService';
import * as emailVerificationService from '../services/emailVerificationService';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { pool } from '../db/pool';

export const authRouter = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    const result = await authService.register(username, email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await passwordResetService.requestReset(email);
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }).parse(req.body);
    await passwordResetService.executeReset(token, newPassword);
    res.json({ message: 'Password has been reset. Please log in again.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await emailVerificationService.verify(token);
    res.json({ message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-verification', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const { rows } = await pool.query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [req.user!.userId],
    );
    if (rows[0]) {
      await emailVerificationService.sendVerification(req.user!.userId, rows[0].email);
    }
    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    next(err);
  }
});
