/**
 * Keyset pagination helper — opaque cursors and reusable WHERE-clause generation.
 *
 * Usage:
 *   1. Decode an incoming cursor via `decodeCursor`.
 *   2. Build the SQL fragment via `buildKeysetClause`, merging its params into
 *      the query's existing parameter list.
 *   3. Fetch `limit + 1` rows so the envelope builder can detect `has_more`.
 *   4. Build the `{ data, cursor, has_more }` envelope via
 *      `buildPaginationEnvelope`, providing a `getCursorKey` accessor that
 *      extracts `{ id, sortKey }` from the row used as the next cursor.
 *
 * The encoded cursor is base64url(JSON.stringify({ id, sortKey })) — it is
 * opaque to clients and encodes both the tiebreaker id and the sort-key value
 * so we never have to round-trip to the database to resolve it.
 *
 * SECURITY: `sortColumn` and `idColumn` in `buildKeysetClause` are interpolated
 * directly into SQL. They MUST come from trusted service-layer constants, NEVER
 * from user input. The only user-supplied values that cross this boundary are
 * the cursor payload's `id` and `sortKey`, which are always passed as bound
 * parameters ($N placeholders).
 */

export interface DecodedCursor {
  id: string;
  sortKey: string;
}

/** Build an opaque base64url cursor from a row's id + sort key. */
export function encodeCursor(row: { id: string; sortKey: string | Date }): string {
  const sortKey = row.sortKey instanceof Date ? row.sortKey.toISOString() : row.sortKey;
  const payload = JSON.stringify({ id: row.id, sortKey });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decode an opaque cursor. Returns null on malformed/tampered input.
 * Never throws. Validates shape: { id: string, sortKey: string }.
 */
export function decodeCursor(cursor: string | undefined | null): DecodedCursor | null {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    return null;
  }
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('id' in parsed) ||
      !('sortKey' in parsed)
    ) {
      return null;
    }
    const { id, sortKey } = parsed as { id: unknown; sortKey: unknown };
    if (typeof id !== 'string' || typeof sortKey !== 'string') {
      return null;
    }
    return { id, sortKey };
  } catch {
    return null;
  }
}

export interface KeysetClauseInput {
  cursor?: string | null;
  /** Qualified column name for the sort key, e.g. "a.logged_at". TRUSTED. */
  sortColumn: string;
  /** Qualified column name for the id tiebreaker, e.g. "a.id". TRUSTED. */
  idColumn: string;
  /** Sort direction. Defaults to DESC (recency feeds). */
  direction?: 'DESC' | 'ASC';
  /** The parameter index to START with when placing $N placeholders. */
  startIndex: number;
}

export interface KeysetClauseOutput {
  /** SQL fragment to append to an existing WHERE. Empty string if no cursor. */
  sql: string;
  /** Parameters to append to the query's existing params. */
  params: unknown[];
}

/**
 * Build the WHERE fragment + parameters for a keyset-paginated query.
 *
 * DESC → `(sortCol < $N OR (sortCol = $N AND idCol < $N+1))`
 * ASC  → `(sortCol > $N OR (sortCol = $N AND idCol > $N+1))`
 *
 * The fragment is prefixed with " AND " so it can be concatenated onto an
 * existing WHERE. Returns an empty fragment (and empty params) when no cursor
 * is supplied or when the cursor fails to decode — either way, the query
 * returns the first page.
 */
export function buildKeysetClause(input: KeysetClauseInput): KeysetClauseOutput {
  const decoded = decodeCursor(input.cursor);
  if (!decoded) {
    return { sql: '', params: [] };
  }
  const op = (input.direction ?? 'DESC') === 'DESC' ? '<' : '>';
  const sortPlaceholder = `$${input.startIndex}`;
  const idPlaceholder = `$${input.startIndex + 1}`;
  const sql = ` AND (${input.sortColumn} ${op} ${sortPlaceholder} OR (${input.sortColumn} = ${sortPlaceholder} AND ${input.idColumn} ${op} ${idPlaceholder}))`;
  return { sql, params: [decoded.sortKey, decoded.id] };
}

export interface BuildEnvelopeInput<T> {
  rows: T[];
  limit: number;
  getCursorKey: (row: T) => { id: string; sortKey: string | Date };
}

export interface PaginationEnvelope<T> {
  data: T[];
  cursor: string | null;
  has_more: boolean;
}

/**
 * Build the `{ data, cursor, has_more }` envelope from an over-fetched row set.
 * The caller must have fetched `limit + 1` rows so we can detect `has_more`
 * without a second query.
 */
export function buildPaginationEnvelope<T>(input: BuildEnvelopeInput<T>): PaginationEnvelope<T> {
  const hasMore = input.rows.length > input.limit;
  const data = hasMore ? input.rows.slice(0, input.limit) : input.rows;
  const last = data[data.length - 1];
  const cursor = hasMore && last !== undefined ? encodeCursor(input.getCursorKey(last)) : null;
  return { data, cursor, has_more: hasMore };
}
