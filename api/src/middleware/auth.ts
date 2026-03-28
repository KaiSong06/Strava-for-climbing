import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

interface JwtPayload {
  userId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function getSecret(): string {
  const secret = process.env['SUPABASE_JWT_SECRET'];
  if (!secret) throw new AppError('SERVER_ERROR', 'SUPABASE_JWT_SECRET not configured', 500);
  return secret;
}

function extractPayload(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret()) as { sub?: string };
  if (!decoded.sub) throw new Error('Missing sub claim');
  return { userId: decoded.sub };
}

/** Attaches req.user if a valid Bearer token is present; never rejects the request. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = extractPayload(header.slice(7));
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
  try {
    req.user = extractPayload(header.slice(7));
    next();
  } catch {
    next(new AppError('UNAUTHORIZED', 'Token expired or invalid', 401));
  }
};
