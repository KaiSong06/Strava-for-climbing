import { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
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

const supabaseUrl = process.env['SUPABASE_URL'];
const JWKS = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

async function extractPayload(token: string): Promise<JwtPayload> {
  if (!JWKS) throw new AppError('SERVER_ERROR', 'SUPABASE_URL not configured', 500);
  const { payload } = await jwtVerify(token, JWKS);
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
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid authorization header', 401));
  }
  try {
    req.user = await extractPayload(header.slice(7));
    next();
  } catch (err) {
    console.error('[auth] JWT verification failed:', err);
    next(new AppError('UNAUTHORIZED', 'Token expired or invalid', 401));
  }
};
