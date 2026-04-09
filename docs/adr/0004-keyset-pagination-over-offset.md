# ADR 0004: Keyset pagination with opaque cursors

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

The feed is the single most request-heavy surface of Crux. Every time a
user opens the app we return a page of ascents sorted by `logged_at`,
then paginate as they scroll. The canonical feed query lives in
`docs/queries/feed.sql` and is implemented in
`api/src/services/feedService.ts`. Ancillary paginated endpoints cover:

- `GET /feed`, `GET /feed/discover`, `GET /feed/gym/:gymId`
- `GET /users/:username/ascents`
- `GET /users/:username/followers`, `GET /users/:username/following`
- `GET /problems/:id/ascents`
- `GET /gyms/:id/problems`

Two pagination strategies were on the table:

- **Offset/limit** (`OFFSET 20 LIMIT 20`). Simple to implement, but on a
  moving feed it skips or duplicates rows. If 5 new ascents are inserted
  while the user is scrolling from page 1 to page 2, rows shift down by
  5 and the first 5 rows of page 2 are the same rows that were the last
  5 rows of page 1.
- **Keyset pagination** on `(logged_at DESC, id DESC)`. The next page is
  defined by "rows whose sort key is strictly less than the last row of
  the previous page", which is stable under insertion churn.

## Decision

All paginated endpoints use keyset pagination with an opaque base64url
cursor. The helper at `api/src/lib/cursorPagination.ts` owns the
encoding and the SQL fragment builder:

- `encodeCursor({ id, sortKey })` → base64url(JSON.stringify(...)).
- `decodeCursor(cursor)` → `{ id, sortKey }` or `null` on tampered/
  malformed input. Never throws.
- `buildKeysetClause({ cursor, sortColumn, idColumn, startIndex })`
  returns `{ sql, params }` for splicing into an existing query. The
  clause is always `(sortCol < $N OR (sortCol = $N AND idCol < $N+1))`
  for DESC, so the `(logged_at DESC, id DESC)` index answers the
  predicate directly.
- `buildPaginationEnvelope({ rows, limit, getCursorKey })` returns
  `{ data, cursor, has_more }` — shape mirrors
  `PaginatedResponse<T>` in `shared/types.ts`.

The service layer fetches `limit + 1` rows so the envelope helper can
detect `has_more` without a second query.

The `sortColumn` and `idColumn` are interpolated into SQL directly and
are REQUIRED to come from trusted service-layer constants, never from
user input. The documentation on that contract lives in the file header
of `cursorPagination.ts`. The only user-supplied values that cross the
boundary are the cursor payload's `id` and `sortKey`, which are always
passed as bound parameters (`$N` placeholders).

## Consequences

**Easier**

- Stable pagination. A user scrolling an active feed will never see
  duplicated rows or skipped rows, regardless of how many new ascents
  are inserted between fetches.
- Index-friendly SQL. Postgres uses `idx_ascents_user_problem`,
  `idx_ascents_problem_id`, and the composite `(logged_at DESC, id
  DESC)` index directly. No full-table scan, no `LIMIT/OFFSET` row
  counting cost.
- One helper for every list endpoint. The follow-list routes in
  `api/src/routes/follows.ts` are a two-line adaptation.
- Opaque cursors mean the client never has to understand the sort key
  semantics. When we added `logged_at DESC, id DESC` as the follow-list
  secondary sort, no mobile client code changed.

**Harder**

- No "page N of M" UI. The client cannot jump to page 50 without
  fetching pages 1–49 first. For a feed, this is a non-issue; for a
  search-results UI or a long table, it would matter. We do not ship
  either of those surfaces today, and the `search` endpoint in
  `api/src/routes/search.ts` caps results at 5 + 5 without pagination.
- No total count. `PaginatedResponse<T>` exposes `has_more` but not
  `total`. This was an intentional trade-off; computing `total` on
  every request is one of the biggest costs of offset pagination, and
  we did not want to add it back. If a screen ever needs a total, we
  will add a dedicated count endpoint for that specific use case.

## Reversal cost

Low. The helper is self-contained (see
`api/src/lib/cursorPagination.test.ts` for its unit coverage) and the
service layer calls are mechanical. Swapping for a different cursor
format or for offset pagination on a specific endpoint is a matter of
hours, not days.
