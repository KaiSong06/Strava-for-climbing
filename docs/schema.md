# Database schema

Current state of the Crux PostgreSQL schema, assembled from
`db/migrations/001_initial_schema.sql` through
`db/migrations/011_auth_trigger.sql`. This is the single source of
truth for the deployed schema — re-generate this file when a new
migration lands.

The schema is hosted on Supabase PostgreSQL with the `pgvector` and
`pgcrypto` extensions enabled. See [ADR 0001](./adr/0001-pgvector-over-elasticsearch.md)
for the pgvector decision.

## Tables (DBML)

```dbml
Table users {
  id                  uuid [pk, default: `gen_random_uuid()`]
  username            text [not null, unique]
  display_name        text [not null]
  avatar_url          text
  home_gym_id         uuid [ref: > gyms.id, note: 'ON DELETE SET NULL']
  phone               text [unique, note: 'E.164 format (Canada-only today)']
  username_changed_at timestamptz [note: 'NULL = never changed; used for cooldown']
  default_visibility  text [not null, default: 'public', note: "check in ('public','friends','private')"]
  created_at          timestamptz [not null, default: `now()`]
}

Table gyms {
  id                      uuid [pk, default: `gen_random_uuid()`]
  name                    text [not null]
  city                    text [not null]
  lat                     double [not null]
  lng                     double [not null]
  default_retirement_days integer [not null, default: 14]
  created_at              timestamptz [not null, default: `now()`]
}

Table problems {
  id               uuid [pk, default: `gen_random_uuid()`]
  gym_id           uuid [not null, ref: > gyms.id, note: 'ON DELETE CASCADE']
  colour           text [not null]
  hold_vector      vector200 [note: 'pgvector; CHECK dim=200; 100 holds × (x,y), zero-padded']
  model_url        text [note: 'GLB 3D relief mesh, optional']
  status           problem_status [not null, default: 'active']
  consensus_grade  text [note: 'Median of user_grade across all ascents']
  total_sends      integer [not null, default: 0]
  first_upload_at  timestamptz [not null, default: `now()`]
  retired_at       timestamptz
  created_at       timestamptz [not null, default: `now()`]
}

Table ascents {
  id         uuid [pk, default: `gen_random_uuid()`]
  user_id    uuid [not null, ref: > users.id, note: 'ON DELETE CASCADE']
  problem_id uuid [not null, ref: > problems.id, note: 'ON DELETE CASCADE']
  type       ascent_type [not null, note: "flash | send | attempt"]
  user_grade text [note: 'e.g. "V4"; optional']
  rating     smallint [note: 'CHECK (rating BETWEEN 1 AND 5)']
  notes      text [note: 'CHECK char_length(notes) <= 280']
  video_url  text
  visibility ascent_visibility [not null, default: 'public', note: "public | friends | private"]
  logged_at  timestamptz [not null, default: `now()`]
  created_at timestamptz [not null, default: `now()`]
}

Table uploads {
  id                uuid [pk, default: `gen_random_uuid()`]
  user_id           uuid [not null, ref: > users.id, note: 'ON DELETE CASCADE']
  problem_id        uuid [ref: > problems.id, note: 'ON DELETE SET NULL; nullable until matched']
  gym_id            uuid [ref: > gyms.id]
  colour            text
  hold_vector       jsonb [note: 'Temporary staging; copied to problems.hold_vector at confirm']
  photo_urls        text_array [not null, default: '{}']
  processing_status processing_status [not null, default: 'pending', note: "pending | processing | awaiting_confirmation | complete | matched | unmatched | failed"]
  similarity_score  double
  created_at        timestamptz [not null, default: `now()`]
}

Table follows {
  follower_id  uuid [ref: > users.id, note: 'ON DELETE CASCADE']
  following_id uuid [ref: > users.id, note: 'ON DELETE CASCADE']
  created_at   timestamptz [not null, default: `now()`]

  indexes {
    (follower_id, following_id) [pk]
  }
  Note: 'CHECK (follower_id <> following_id)'
}

Table match_disputes {
  id            uuid [pk, default: `gen_random_uuid()`]
  upload_id     uuid [not null, ref: > uploads.id, note: 'ON DELETE CASCADE']
  reported_by   uuid [not null, ref: > users.id, note: 'ON DELETE CASCADE']
  status        dispute_status [not null, default: 'open', note: "open | resolved_confirm | resolved_split"]
  votes_confirm integer [not null, default: 0]
  votes_split   integer [not null, default: 0]
  created_at    timestamptz [not null, default: `now()`]
}

Table push_tokens {
  id         uuid [pk, default: `gen_random_uuid()`]
  user_id    uuid [not null, ref: > users.id, note: 'ON DELETE CASCADE']
  token      text [not null, unique, note: 'Expo push token']
  created_at timestamptz [not null, default: `now()`]
}
```

Paste the block above into [dbdiagram.io](https://dbdiagram.io) or any
DBML renderer to see the ER diagram graphically. GitHub renders the
block as a plain code fence; the diagram is optional.

## Enums

| Enum                  | Values                                                                          | Migration |
| --------------------- | ------------------------------------------------------------------------------- | --------- |
| `problem_status`      | `active`, `retired`                                                             | 001       |
| `ascent_type`         | `flash`, `send`, `attempt`                                                      | 001       |
| `ascent_visibility`   | `public`, `friends`, `private`                                                  | 001       |
| `processing_status`   | `pending`, `processing`, `matched`, `unmatched`, `failed`, `awaiting_confirmation`, `complete` | 001 + 003 |
| `dispute_status`      | `open`, `resolved_confirm`, `resolved_split`                                    | 001       |

## Key indexes

| Index                               | Table     | Columns                              | Migration | Why |
| ----------------------------------- | --------- | ------------------------------------ | --------- | --- |
| `idx_problems_gym_id`               | problems  | `(gym_id)`                           | 001       | Gym-scoped queries |
| `idx_problems_colour`               | problems  | `(colour)`                           | 001       | Colour filter |
| `idx_problems_gym_colour`           | problems  | `(gym_id, colour)`                   | 001       | Pre-filter for ANN similarity search (see ADR 0001) |
| `idx_problems_hold_vector`          | problems  | `ivfflat (hold_vector vector_cosine_ops) WITH (lists = 100)` | 004 | IVFFlat ANN cosine index, tuned for ~10k active problems / gym |
| `idx_ascents_user_problem`          | ascents   | `(user_id, problem_id)`              | 001       | Flash-vs-send lookup and user profile feed |
| `idx_ascents_problem_id`            | ascents   | `(problem_id)`                       | 001       | Consensus-grade aggregation |
| `idx_uploads_user_id`               | uploads   | `(user_id)`                          | 001       | User's upload history |
| `idx_uploads_problem_id`            | uploads   | `(problem_id)`                       | 001       | Problem → upload lookups |
| `idx_uploads_processing_active`     | uploads   | `(created_at) WHERE processing_status IN ('pending', 'processing')` | 010 | Partial index: vision worker polling path only scans in-flight rows, not the much larger set of terminal rows |
| `idx_follows_follower_id`           | follows   | `(follower_id)`                      | 001       | "Who am I following" |
| `idx_follows_following_id`          | follows   | `(following_id)`                     | 001       | "Who follows me" |
| `idx_match_disputes_upload_id`      | match_disputes | `(upload_id)`                   | 001       | Dispute lookup by upload |
| `idx_push_tokens_user`              | push_tokens | `(user_id)`                        | 006       | Fan-out push delivery |

## Key constraints and invariants

- **`problems.hold_vector`** must be NULL or exactly 200-dimensional.
  Enforced by `problems_hold_vector_dim_200` in migration 010
  (`CHECK (hold_vector IS NULL OR vector_dims(hold_vector) = 200)`).
  The constraint is the last line of defence against a vision worker
  bug silently inserting the wrong-dim vector.
- **`follows`** has `CHECK (follower_id <> following_id)` to prevent
  self-follows at the database level.
- **`ascents.notes`** has `CHECK (char_length(notes) <= 280)`.
- **`ascents.rating`** has `CHECK (rating BETWEEN 1 AND 5)`.
- **`users.default_visibility`** has a CHECK that restricts it to
  `('public', 'friends', 'private')` (migration 009).
- **Flash vs send** is NOT stored on the user-supplied input. The
  `ascents.type` column is determined at write time by
  `ascentService.createAscent`: if the user has no prior ascent on the
  same problem, it becomes a `flash`; otherwise `send`. Never trust
  client self-reports for this — see the root `CLAUDE.md` "Architecture
  rules" section.
- **Visibility rules** for feeds:
  - `public`: visible to everyone.
  - `friends`: visible only to users who mutually follow the author.
  - `private`: visible only to the author themselves. Even private
    ascents still contribute anonymously to aggregate stats
    (`total_sends`, `consensus_grade`) on `problems`.
- **Retirement semantics**: a problem is retired nightly (via
  `runRetirement()` invoked from
  `api/src/jobs/retirementJob.ts` at 02:00 UTC, or via
  `POST /internal/run-retirement` guarded by `INTERNAL_SECRET`) when
  `NOW() - first_upload_at > gyms.default_retirement_days`. Retired
  problems stay in the database — `status` flips to `retired`,
  `retired_at` is set, and ascents remain linked to the historical
  problem row.
- **Supabase Auth trigger** (`on_auth_user_created` in migration 011)
  auto-inserts a `public.users` row on `INSERT INTO auth.users`. The
  migration is guarded on the presence of the `auth` schema so local/
  test environments (plain pgvector containers) apply it as a no-op.

## How to regenerate

When a new migration lands:

1. Update the DBML block above with any new tables, columns, or enum
   values.
2. Update the **Key indexes** table with any new indexes.
3. Update **Key constraints and invariants** if the new migration adds
   a CHECK, trigger, or semantic rule.
4. Commit alongside the migration itself so this file never drifts.
