import { RequestHandler } from 'express';
import { pool } from '../db/pool';
import { AppError } from './errorHandler';

export const requireVerified: RequestHandler = async (req, _res, next) => {
  try {
    const { rows } = await pool.query<{ email_verified: boolean }>(
      'SELECT email_verified FROM users WHERE id = $1',
      [req.user!.userId],
    );

    if (!rows[0]?.email_verified) {
      return next(new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before continuing', 403));
    }

    next();
  } catch (err) {
    next(err);
  }
};
