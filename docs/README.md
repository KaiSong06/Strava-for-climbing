# Crux documentation

Documentation that lives in the repo and tracks the code. Start here.

## Architecture Decision Records

Why the stack looks the way it does. Each ADR is a short narrative
with context, decision, and consequences.

- [ADR index](./adr/README.md)
- [0001: pgvector over Elasticsearch](./adr/0001-pgvector-over-elasticsearch.md)
- [0002: BullMQ over Temporal](./adr/0002-bullmq-over-temporal.md)
- [0003: Supabase Auth over custom](./adr/0003-supabase-auth-over-custom.md)
- [0004: Keyset pagination over offset](./adr/0004-keyset-pagination-over-offset.md)
- [0005: Vision pipeline async boundary](./adr/0005-vision-pipeline-async-boundary.md)
- [0006: Sentry-native logging](./adr/0006-sentry-native-logging.md)
- [0007: Shared types via path alias](./adr/0007-shared-types-via-path-alias.md)

## API reference

The OpenAPI 3.1 spec is generated from the Zod-backed registry in
`api/src/lib/openapi.ts`:

- [openapi.json](./openapi.json) — generated spec; paste into
  [editor.swagger.io](https://editor.swagger.io) or any OpenAPI viewer
- Regenerate: `cd api && npm run docs:openapi`

## Schema

- [schema.md](./schema.md) — DBML ER diagram, indexes, constraints,
  and invariants. Assembled from `db/migrations/*.sql`.
- [queries/feed.sql](./queries/feed.sql) — reference SQL for the
  personal / gym feed (the canonical implementation
  `api/src/services/feedService.ts` should match)

## Per-directory CLAUDE.md (deeper reference)

Each subdirectory ships its own focused reference. Read these when
working inside a single surface:

- Repo root: [../CLAUDE.md](../CLAUDE.md) — stack, env vars,
  architecture rules, code style
- API: [../api/CLAUDE.md](../api/CLAUDE.md) — Express layers, auth
  middleware, rate limiting, vision worker
- Mobile: [../mobile/CLAUDE.md](../mobile/CLAUDE.md) — Expo Router,
  Zustand stores, theme tokens
- Vision: [../vision/CLAUDE.md](../vision/CLAUDE.md) — SAM ViT-B +
  MiDaS pipeline, FastAPI lifespan
- Database: [../db/CLAUDE.md](../db/CLAUDE.md) — migration index and
  seed commands
- Tests: [../test/CLAUDE.md](../test/CLAUDE.md) — E2E harness and
  testcontainers setup
- This directory: [CLAUDE.md](./CLAUDE.md) — notes on the queries
  subdirectory

## Contributing to docs

- ADRs are immutable once accepted. Add a new ADR to supersede an old
  one; never rewrite history.
- The OpenAPI spec is generated. Do not hand-edit `openapi.json`;
  edit `api/src/lib/openapi.ts` and re-run the script.
- `schema.md` is hand-maintained alongside the migration that
  changes the schema. Update both in the same commit.
