# ADR 0001: pgvector over Elasticsearch / Pinecone / Weaviate

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

Crux's core differentiator is photo-based hold detection that auto-clusters
each upload with the correct gym problem. The matcher boils each photo down
to a 200-dimensional vector (100 holds max × 2 coordinates, zero-padded) and
runs cosine similarity against every active problem at the same gym of the
same colour. The raw candidate set is tiny — at most ~10k active problems
per gym (see `db/migrations/004_vector_index.sql`) — but the lookup must be
transactionally coupled to the ascent write path:

1. Vision worker inserts a vector on `uploads.hold_vector` (temporary).
2. Worker runs ANN search over `problems.hold_vector` with
   `WHERE gym_id = $1 AND colour = $2` pre-filter.
3. If the top match scores >= 0.92, the upload is linked to the matched
   problem, the ascent is created, and `total_sends` / `consensus_grade`
   are recalculated — all in the same database transaction boundary.

The options we looked at were:

- **Elasticsearch** with a dense vector field.
- **Pinecone** or **Weaviate** as a managed vector DB.
- **pgvector** inside the existing Supabase PostgreSQL instance.

## Decision

We store `hold_vector` as `vector(200)` directly on `problems` inside the
Supabase PostgreSQL database, with an IVFFlat cosine index sized for the
expected per-gym candidate set:

```sql
-- db/migrations/004_vector_index.sql
CREATE INDEX idx_problems_hold_vector
  ON problems USING ivfflat (hold_vector vector_cosine_ops)
  WITH (lists = 100);
```

Every ANN query MUST first pre-filter by `(gym_id, colour)` using the
companion btree index `idx_problems_gym_colour` defined in
`db/migrations/001_initial_schema.sql`. That keeps the candidate set well
under the ~10k threshold IVFFlat is tuned for and makes the ANN step
essentially free.

A belt-and-braces invariant lives in `db/migrations/010_hardening.sql`: a
CHECK constraint enforces `vector_dims(hold_vector) = 200` so a vision
worker bug can never silently insert a wrong-dim vector.

## Consequences

**Easier**

- One database to run, back up, monitor, and query. Supabase already gives
  us pooled PostgreSQL; we flipped on the pgvector extension and moved on.
- Transactional coupling: a single `BEGIN … COMMIT` can write the upload,
  the matched problem link, and the ascent. Two-store consistency is not
  a concern we have to reason about.
- Schema tooling, migrations, seeds, and local testcontainers all use the
  same Postgres image (`pgvector/pgvector:pg16`). No second client, no
  second API to version.
- Cost: the marginal cost of a vector column plus one IVFFlat index on
  Supabase is negligible compared with a dedicated vector DB subscription.

**Harder**

- If Crux ever needs cross-gym similarity over millions of vectors (for
  example, a global "this looks like V8 dyno problems at other gyms"
  discovery feature), IVFFlat with `lists = 100` will stop being the right
  tool. At that point we would either re-tune `lists`, move to an HNSW
  index (available in newer pgvector releases), or extract the vector
  workload into a purpose-built store. The point of this ADR is to say we
  explicitly accept that refactor cost later in exchange for operational
  simplicity now.
- No full-text search on the same index. That's fine — Crux does not need
  full-text search on problems; user and gym search uses `ILIKE` against
  indexed columns in `api/src/routes/search.ts`.

## Reversal cost

Low-to-medium. The vector column is internal to the vision worker and the
match pipeline. No mobile client code or shared type references
`hold_vector` directly — `shared/types.ts` exposes it as `number[] | null`
on `Problem` but it is never consumed in the UI. Swapping the store means
writing a sync job and changing the ANN query path in the vision worker;
the rest of the app is unaffected.
