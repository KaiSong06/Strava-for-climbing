import { RequestHandler } from 'express';
import { jwtVerify } from 'jose';
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

const jwtSecret = process.env['SUPABASE_JWT_SECRET'];
const secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;

async function extractPayload(token: string): Promise<JwtPayload> {
  if (!secret) throw new AppError('SERVER_ERROR', 'SUPABASE_JWT_SECRET not configured', 500);
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub) throw new Error('Missing sub claim');
  return { userId: payload.sub };
}

/** Attaches req.user if a valid Bearer token is present; never rejects the request. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = await extractPayload(header.slice(7));
  } catch {
    // invalid/expired — continue unauthenticated
  }
  next();
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers['authorization'];
  console.log('[auth] header present:', !!header, 'starts with Bearer:', header?.startsWith('Bearer '));
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid authorization header', 401));
  }
  try {
    req.user = await extractPayload(header.slice(7));
    console.log('[auth] verified userId:', req.user.userId);
    next();
  } catch (err) {
    console.error('[auth] JWT verification failed:', err);
    next(new AppError('UNAUTHORIZED', 'Token expired or invalid', 401));
  }
};
