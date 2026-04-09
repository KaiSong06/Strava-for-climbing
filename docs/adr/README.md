# Architecture Decision Records

An **Architecture Decision Record** (ADR) captures a single architectural
decision, its context, and the consequences of choosing it over the
alternatives. ADRs are immutable once accepted — when a decision is
superseded, we add a new ADR instead of rewriting the old one. The
format is a minimal Michael Nygard template: context, decision,
consequences.

## Index

| #    | Title                                                                        | Status   | Date       |
| ---- | ---------------------------------------------------------------------------- | -------- | ---------- |
| 0001 | [pgvector over Elasticsearch](./0001-pgvector-over-elasticsearch.md)         | Accepted | 2026-04-09 |
| 0002 | [BullMQ over Temporal](./0002-bullmq-over-temporal.md)                       | Accepted | 2026-04-09 |
| 0003 | [Supabase Auth over custom](./0003-supabase-auth-over-custom.md)             | Accepted | 2026-04-09 |
| 0004 | [Keyset pagination over offset](./0004-keyset-pagination-over-offset.md)     | Accepted | 2026-04-09 |
| 0005 | [Vision pipeline async boundary](./0005-vision-pipeline-async-boundary.md)   | Accepted | 2026-04-09 |
| 0006 | [Sentry-native logging](./0006-sentry-native-logging.md)                     | Accepted | 2026-04-09 |
| 0007 | [Shared types via path alias](./0007-shared-types-via-path-alias.md)         | Accepted | 2026-04-09 |

## Adding a new ADR

1. Pick the next unused number (`0008`, `0009`, …).
2. Create `docs/adr/NNNN-short-kebab-title.md` using the template
   below.
3. Add a row to the index above.
4. If the new ADR supersedes an existing one, set the old ADR's
   **Status** to `Superseded by NNNN` and leave its content intact.

## Template

```markdown
# ADR NNNN: <Short title>

- **Status:** Proposed | Accepted | Superseded by ADR NNNN
- **Date:** YYYY-MM-DD
- **Deciders:** Engineering team

## Context

<Why we needed to make a decision. What was the problem or constraint?>

## Decision

<What did we actually decide?>

## Consequences

<What becomes easier / harder as a result? What's the cost of reversal?>
```

Keep each ADR to 60–120 lines. An ADR is a decision narrative, not a
design document — if it's getting longer than 120 lines, split the
peripheral detail into a separate doc under `docs/` and link from the
ADR.
