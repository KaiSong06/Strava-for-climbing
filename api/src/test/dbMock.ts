/**
 * Shared mock for the pg Pool used by all services.
 *
 * Usage in test files:
 *   jest.mock('../db/pool', () => require('../test/dbMock').poolModule);
 *   import { mockQuery, resetMock } from '../test/dbMock';
 *
 * Then set up per-test return values:
 *   mockQuery.mockResolvedValueOnce({ rows: [...], rowCount: 1 });
 */
import type { QueryResult } from 'pg';

type QueryFn = jest.Mock<Promise<Partial<QueryResult>>, [string, unknown[]?]>;

export const mockQuery: QueryFn = jest.fn();

export function resetMock(): void {
  mockQuery.mockReset();
}

export const poolModule = {
  pool: { query: mockQuery },
};
