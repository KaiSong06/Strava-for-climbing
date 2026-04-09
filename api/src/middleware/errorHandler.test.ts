import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { AppError, errorHandler } from './errorHandler';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

function makeMocks() {
  const req = {} as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('AppError', () => {
  it('should set code, message, and statusCode', () => {
    const err = new AppError('NOT_FOUND', 'User not found', 404);

    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should default statusCode to 400', () => {
    const err = new AppError('BAD_REQUEST', 'Missing field');

    expect(err.statusCode).toBe(400);
  });
});

describe('errorHandler', () => {
  it('should handle AppError with correct status and body', () => {
    const { req, res, next } = makeMocks();
    const err = new AppError('NOT_FOUND', 'Gym not found', 404);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Gym not found' },
    });
  });

  it('should handle ZodError with 400 and formatted message', () => {
    const { req, res, next } = makeMocks();
    const issues: ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
      { code: 'invalid_type', expected: 'number', received: 'string', path: ['age'], message: 'Expected number' },
    ];
    const err = new ZodError(issues);

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name: Expected string; age: Expected number',
      },
    });
  });

  it('should handle Postgres 22P02 invalid input syntax error', () => {
    const { req, res, next } = makeMocks();
    const err = { code: '22P02', message: 'invalid input syntax for type uuid' };

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INVALID_PARAM', message: 'Invalid parameter format.' },
    });
  });

  it('should handle unknown errors with 500 and capture in Sentry', () => {
    const Sentry = require('@sentry/node');
    const { req, res, next } = makeMocks();
    const err = new Error('Something broke');

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(err, req, res, next);
    errSpy.mockRestore();

    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  it('should handle plain object errors (non-Error, non-AppError)', () => {
    const Sentry = require('@sentry/node');
    const { req, res, next } = makeMocks();
    const err = { message: 'weird bag of bits' };

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(err, req, res, next);
    errSpy.mockRestore();

    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should handle null errors without crashing', () => {
    const Sentry = require('@sentry/node');
    const { req, res, next } = makeMocks();

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(null, req, res, next);
    errSpy.mockRestore();

    expect(Sentry.captureException).toHaveBeenCalledWith(null);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should treat Postgres-like objects without code 22P02 as unknown', () => {
    const Sentry = require('@sentry/node');
    const { req, res, next } = makeMocks();
    const err = { code: '42P01', message: 'relation "foo" does not exist' };

    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(err, req, res, next);
    errSpy.mockRestore();

    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
