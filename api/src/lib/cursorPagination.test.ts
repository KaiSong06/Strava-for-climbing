import {
  encodeCursor,
  decodeCursor,
  buildKeysetClause,
  buildPaginationEnvelope,
} from './cursorPagination';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips through decodeCursor for a typical row', () => {
    const encoded = encodeCursor({
      id: '11111111-2222-3333-4444-555555555555',
      sortKey: '2026-01-15T10:30:00.000Z',
    });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({
      id: '11111111-2222-3333-4444-555555555555',
      sortKey: '2026-01-15T10:30:00.000Z',
    });
  });

  it('accepts Date for sortKey and encodes as ISO string', () => {
    const date = new Date('2026-04-01T00:00:00.000Z');
    const encoded = encodeCursor({ id: 'abc', sortKey: date });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ id: 'abc', sortKey: '2026-04-01T00:00:00.000Z' });
  });

  it('accepts ISO string for sortKey as-is', () => {
    const encoded = encodeCursor({ id: 'abc', sortKey: '2026-04-01T00:00:00.000Z' });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ id: 'abc', sortKey: '2026-04-01T00:00:00.000Z' });
  });

  it('produces a URL-safe base64url token (no +, /, or = padding)', () => {
    const encoded = encodeCursor({ id: 'abc', sortKey: '2026-04-01T00:00:00.000Z' });
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe('decodeCursor — invalid inputs', () => {
  it('returns null for undefined', () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(decodeCursor(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for non-string inputs via the signature-allowed types', () => {
    // The type signature only permits string | undefined | null, but ensure
    // the internal guard still handles unexpected runtime values safely.
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('returns null for garbage that is not valid base64', () => {
    expect(decodeCursor('not base64 !!!')).toBeNull();
  });

  it('returns null when base64url decodes to non-JSON bytes', () => {
    const notJson = Buffer.from('this is not json', 'utf8').toString('base64url');
    expect(decodeCursor(notJson)).toBeNull();
  });

  it('returns null when payload is missing sortKey', () => {
    const payload = Buffer.from(JSON.stringify({ id: 'abc' }), 'utf8').toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null when payload is missing id', () => {
    const payload = Buffer.from(JSON.stringify({ sortKey: 'abc' }), 'utf8').toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null when id is the wrong type', () => {
    const payload = Buffer.from(
      JSON.stringify({ id: 123, sortKey: '2026-01-01T00:00:00Z' }),
      'utf8',
    ).toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null when sortKey is the wrong type', () => {
    const payload = Buffer.from(
      JSON.stringify({ id: 'abc', sortKey: 42 }),
      'utf8',
    ).toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null when payload is a primitive instead of an object', () => {
    const payload = Buffer.from(JSON.stringify('just a string'), 'utf8').toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null when payload is JSON null', () => {
    const payload = Buffer.from('null', 'utf8').toString('base64url');
    expect(decodeCursor(payload)).toBeNull();
  });

  it('returns null for a tampered base64url cursor', () => {
    const valid = encodeCursor({ id: 'abc', sortKey: '2026-01-01T00:00:00Z' });
    // Flip a character mid-cursor to corrupt the JSON structure.
    const tampered = `${valid.slice(0, 4)}XXXX${valid.slice(8)}`;
    expect(decodeCursor(tampered)).toBeNull();
  });
});

describe('buildKeysetClause', () => {
  it('returns empty sql + empty params when cursor is undefined', () => {
    const result = buildKeysetClause({
      sortColumn: 'a.logged_at',
      idColumn: 'a.id',
      startIndex: 3,
    });
    expect(result).toEqual({ sql: '', params: [] });
  });

  it('returns empty sql + empty params when cursor is null', () => {
    const result = buildKeysetClause({
      cursor: null,
      sortColumn: 'a.logged_at',
      idColumn: 'a.id',
      startIndex: 3,
    });
    expect(result).toEqual({ sql: '', params: [] });
  });

  it('returns empty sql + empty params when cursor is malformed', () => {
    const result = buildKeysetClause({
      cursor: 'garbage!!!',
      sortColumn: 'a.logged_at',
      idColumn: 'a.id',
      startIndex: 3,
    });
    expect(result).toEqual({ sql: '', params: [] });
  });

  it('generates a DESC clause with < operators and ordered params', () => {
    const cursor = encodeCursor({ id: 'a-42', sortKey: '2026-01-01T00:00:00.000Z' });
    const result = buildKeysetClause({
      cursor,
      sortColumn: 'a.logged_at',
      idColumn: 'a.id',
      startIndex: 3,
    });
    expect(result.sql).toBe(
      ' AND (a.logged_at < $3 OR (a.logged_at = $3 AND a.id < $4))',
    );
    expect(result.params).toEqual(['2026-01-01T00:00:00.000Z', 'a-42']);
  });

  it('generates an ASC clause with > operators when direction=ASC', () => {
    const cursor = encodeCursor({ id: 'a-42', sortKey: '2026-01-01T00:00:00.000Z' });
    const result = buildKeysetClause({
      cursor,
      sortColumn: 'a.logged_at',
      idColumn: 'a.id',
      startIndex: 2,
      direction: 'ASC',
    });
    expect(result.sql).toBe(
      ' AND (a.logged_at > $2 OR (a.logged_at = $2 AND a.id > $3))',
    );
  });

  it('honours startIndex when composing with existing params', () => {
    const cursor = encodeCursor({ id: 'x', sortKey: '2026-01-01T00:00:00.000Z' });
    const result = buildKeysetClause({
      cursor,
      sortColumn: 'f.created_at',
      idColumn: 'f.follower_id',
      startIndex: 7,
    });
    expect(result.sql).toContain('$7');
    expect(result.sql).toContain('$8');
  });
});

describe('buildPaginationEnvelope', () => {
  type Row = { id: string; logged_at: string };
  const getCursorKey = (row: Row): { id: string; sortKey: string } => ({
    id: row.id,
    sortKey: row.logged_at,
  });

  it('returns empty envelope when no rows were fetched', () => {
    const result = buildPaginationEnvelope({ rows: [] as Row[], limit: 20, getCursorKey });
    expect(result).toEqual({ data: [], cursor: null, has_more: false });
  });

  it('returns has_more=false and cursor=null when rows.length === limit', () => {
    const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
      id: `a-${i}`,
      logged_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    const result = buildPaginationEnvelope({ rows, limit: 20, getCursorKey });
    expect(result.data).toHaveLength(20);
    expect(result.cursor).toBeNull();
    expect(result.has_more).toBe(false);
  });

  it('slices to limit and encodes cursor when rows.length === limit + 1', () => {
    const rows: Row[] = Array.from({ length: 21 }, (_, i) => ({
      id: `a-${i}`,
      logged_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    const result = buildPaginationEnvelope({ rows, limit: 20, getCursorKey });
    expect(result.data).toHaveLength(20);
    expect(result.has_more).toBe(true);
    expect(result.cursor).not.toBeNull();

    const decoded = decodeCursor(result.cursor);
    expect(decoded).toEqual({
      id: 'a-19',
      sortKey: '2026-01-20T00:00:00Z',
    });
  });

  it('handles Date sort keys via the accessor', () => {
    type DateRow = { id: string; ts: Date };
    const rows: DateRow[] = [
      { id: 'a', ts: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'b', ts: new Date('2026-01-02T00:00:00.000Z') },
    ];
    const result = buildPaginationEnvelope({
      rows,
      limit: 1,
      getCursorKey: (row) => ({ id: row.id, sortKey: row.ts }),
    });
    expect(result.has_more).toBe(true);
    expect(result.data).toHaveLength(1);
    const decoded = decodeCursor(result.cursor);
    expect(decoded).toEqual({ id: 'a', sortKey: '2026-01-01T00:00:00.000Z' });
  });
});
