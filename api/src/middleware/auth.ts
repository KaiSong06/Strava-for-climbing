import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

interface JwtPayload {
  userId: string;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Attaches req.user if a valid Bearer token is present; never rejects the request. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  const secret = process.env['JWT_SECRET'];
  if (!secret) return next();
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
  } catch {
    // invalid/expired — continue unauthenticated
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid authorization header', 401));
  }
  const token = header.slice(7);
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    return next(new AppError('SERVER_ERROR', 'JWT secret not configured', 500));
  }
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    next(new AppError('UNAUTHORIZED', 'Token expired or invalid', 401));
  }
};
