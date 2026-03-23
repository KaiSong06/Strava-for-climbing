import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
  });
}

/** Applied globally — permissive fallback for all routes. */
export const defaultLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Applied to auth endpoints (register, login, refresh, forgot/reset password). */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Applied to POST /uploads. */
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});
