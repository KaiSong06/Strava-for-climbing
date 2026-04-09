/**
 * Full branch coverage for src/middleware/auth.ts.
 *
 * Covers every path in both `requireAuth` and `optionalAuth`, plus the
 * "SUPABASE_URL not configured" startup guard. Uses a real ES256 keypair
 * generated via jose and mocks only `createRemoteJWKSet` so JWT verification
 * runs against our in-memory public key.
 */
import type { Request, Response, NextFunction } from 'express';
import { generateTestKeypair, signTestToken, installJwksMock } from '../test/fakeJwks';

// Install the JWKS mock BEFORE importing auth.ts so the module picks it up.
installJwksMock();

// Ensure SUPABASE_URL is set so createRemoteJWKSet is actually instantiated
// (auth.ts bails to a SERVER_ERROR path if the env is missing at import time).
process.env['SUPABASE_URL'] = 'https://test.supabase.co';

// Now import the middleware under test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireAuth, optionalAuth } = require('./auth') as typeof import('./auth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppError } = require('./errorHandler') as typeof import('./errorHandler');

interface MockReq {
  headers: Record<string, string>;
  user?: { userId: string };
}

function makeReq(headers: Record<string, string> = {}): MockReq {
  return { headers };
}

function makeRes(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeNext(): jest.Mock {
  return jest.fn();
}

describe('auth middleware — requireAuth', () => {
  beforeAll(async () => {
    await generateTestKeypair();
  });

  it('attaches req.user when the token is valid', async () => {
    const token = await signTestToken({ sub: 'user-123' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(req.user).toEqual({ userId: 'user-123' });
  });

  it('rejects 401 when the Authorization header is missing', async () => {
    const req = makeReq({});
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as InstanceType<typeof AppError>).statusCode).toBe(401);
    expect((err as InstanceType<typeof AppError>).code).toBe('UNAUTHORIZED');
  });

  it('rejects 401 when the header is malformed (no Bearer prefix)', async () => {
    const req = makeReq({ authorization: 'Token abc.def.ghi' });
    const res = makeRes();
    const next = makeNext();

    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);

    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as InstanceType<typeof AppError>).statusCode).toBe(401);
  });

  it('rejects 401 when the token is expired', async () => {
    const expiredToken = await signTestToken({
      sub: 'user-123',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const req = makeReq({ authorization: `Bearer ${expiredToken}` });
    const res = makeRes();
    const next = makeNext();

    // Silence the console.error call inside the catch branch
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);

    errSpy.mockRestore();
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as InstanceType<typeof AppError>).statusCode).toBe(401);
    expect((err as InstanceType<typeof AppError>).message).toMatch(/expired|invalid/i);
  });

  it('rejects 401 when the token is signed with the wrong key', async () => {
    // Sign with a key that is NOT the shared keypair
    const { generateKeyPair, SignJWT } = await import('jose');
    const wrong = await generateKeyPair('ES256');
    const badToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('user-123')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrong.privateKey);

    const req = makeReq({ authorization: `Bearer ${badToken}` });
    const res = makeRes();
    const next = makeNext();

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);
    errSpy.mockRestore();

    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as InstanceType<typeof AppError>).statusCode).toBe(401);
  });

  it('rejects 401 when the token has no sub claim', async () => {
    const { SignJWT } = await import('jose');
    const { getSharedKeypair } = await import('../test/fakeJwks');
    const tokenNoSub = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getSharedKeypair().privateKey);

    const req = makeReq({ authorization: `Bearer ${tokenNoSub}` });
    const res = makeRes();
    const next = makeNext();

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await requireAuth(req as unknown as Request, res, next as unknown as NextFunction);
    errSpy.mockRestore();

    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as InstanceType<typeof AppError>).statusCode).toBe(401);
  });

  it('classifies non-Error JWT failures as "unknown" in the warn log', async () => {
    // Covers the `err instanceof Error ? … : 'unknown'` branch inside the
    // requireAuth catch block. We reimport auth.ts against a custom jose
    // mock whose jwtVerify throws a plain string, exercising the non-Error
    // arm of the ternary on line 57.
    jest.resetModules();
    jest.doMock('jose', () => {
      const actual = jest.requireActual('jose') as typeof import('jose');
      return {
        ...actual,
        createRemoteJWKSet: () => async () => ({}) as unknown,
        jwtVerify: () => {
          throw 'string-not-error';
        },
      };
    });
    process.env['SUPABASE_URL'] = 'https://test.supabase.co';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireAuth: freshRequireAuth } = require('./auth') as typeof import('./auth');

    const req = makeReq({ authorization: 'Bearer whatever.token.value' });
    const res = makeRes();
    const next = makeNext();

    await freshRequireAuth(req as unknown as Request, res, next as unknown as NextFunction);

    jest.resetModules();
    const err = next.mock.calls[0]?.[0];
    // Cannot use `instanceof AppError` here because resetModules() created a
    // fresh AppError class identity in the re-required module graph. Assert
    // on the duck-typed shape instead.
    expect(err).toBeDefined();
    expect((err as { statusCode: number; code: string }).statusCode).toBe(401);
    expect((err as { statusCode: number; code: string }).code).toBe('UNAUTHORIZED');
  });
});

describe('auth middleware — optionalAuth', () => {
  beforeAll(async () => {
    await generateTestKeypair();
  });

  it('attaches req.user when a valid token is present', async () => {
    const token = await signTestToken({ sub: 'user-abc' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(req.user).toEqual({ userId: 'user-abc' });
  });

  it('continues without rejecting when the token is invalid', async () => {
    const { generateKeyPair, SignJWT } = await import('jose');
    const wrong = await generateKeyPair('ES256');
    const badToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject('user-xyz')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrong.privateKey);

    const req = makeReq({ authorization: `Bearer ${badToken}` });
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it('continues without req.user when the header is missing', async () => {
    const req = makeReq({});
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it('continues without req.user when the header has no Bearer prefix', async () => {
    const req = makeReq({ authorization: 'Token foo.bar.baz' });
    const res = makeRes();
    const next = makeNext();

    await optionalAuth(req as unknown as Request, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
    expect(req.user).toBeUndefined();
  });
});

describe('auth middleware — missing SUPABASE_URL', () => {
  /**
   * When SUPABASE_URL is unset at import time, `JWKS` is null and the
   * private `extractPayload()` throws an `AppError('SERVER_ERROR', …, 500)`
   * which propagates via the catch branch as UNAUTHORIZED 401
   * (requireAuth swallows all verify errors into a generic 401).
   * This exercises the JWKS-null branch.
   */
  let requireAuthFresh: typeof import('./auth').requireAuth;

  beforeAll(async () => {
    jest.resetModules();
    // Re-install the jose mock in this new module registry.
    jest.doMock('jose', () => {
      const actual = jest.requireActual('jose') as typeof import('jose');
      return {
        ...actual,
        createRemoteJWKSet: () => async () => {
          // should never be called in this branch
          throw new Error('unexpected JWKS call');
        },
      };
    });
    const prev = process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_URL'];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({ requireAuth: requireAuthFresh } = require('./auth') as typeof import('./auth'));
    } finally {
      if (prev !== undefined) process.env['SUPABASE_URL'] = prev;
    }
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('short-circuits to 401 when JWKS is not configured', async () => {
    const req = makeReq({ authorization: 'Bearer whatever' });
    const res = makeRes();
    const next = makeNext();

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await requireAuthFresh(req as unknown as Request, res, next as unknown as NextFunction);
    errSpy.mockRestore();

    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(Error);
    // requireAuth converts any thrown verify error into an UNAUTHORIZED AppError.
    expect((err as { statusCode?: number }).statusCode).toBe(401);
  });
});
