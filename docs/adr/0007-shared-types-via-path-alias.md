# ADR 0007: Shared contract types via `@shared/*` path alias

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

The API (`/api`, TypeScript) and the mobile app (`/mobile`, TypeScript
under Expo) speak the same JSON over HTTP. Before Sprint 1 Track C
(commit `32eb83c`, "refactor: unify shared types via @shared/* path
alias") the contract types were duplicated: `FeedItem`, `UserProfile`,
`ApiError`, `PaginatedResponse<T>`, and friends existed once in the
API services and once — drifting — inside the mobile codebase.

The usual drift symptoms showed up:

- `avatar_url` was optional on mobile but `string | null` on the API,
  so a mobile check `user.avatar_url?.length` was silently wrong.
- A new `consensus_grade` field was added on the API, never made it
  to mobile, and feed cards showed `undefined`.
- Enum string literals (`AscentVisibility`, `ProcessingStatus`) had to
  be updated in two places when a new state was added.

We considered three options:

- **Publish an npm package** (`@crux/shared`). Fully correct, but
  requires a publish/install step every time the contract changes,
  which in turn slows down agent-driven iteration.
- **Relative imports across the monorepo root** (`../../shared/types`).
  Works but every import line depends on where the consumer lives.
  Fragile under refactors.
- **TypeScript path alias** (`@shared/*`) backed by a shared file. The
  tsconfigs on both sides resolve the alias; at build time `tsc-alias`
  rewrites the paths to plain relative imports.

## Decision

All cross-surface contract types live in `shared/types.ts`. Both the
API and the mobile app import via the `@shared/*` path alias.

**API side** (`api/tsconfig.json`):

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "scripts/**/*", "../shared/**/*"]
}
```

Build: `tsc && tsc-alias`. `tsc` compiles; `tsc-alias` rewrites the
`@shared/*` specifiers in the emitted JS to plain relative paths so
Node resolves them at runtime without `tsconfig-paths`.

**Dev-time** uses `tsconfig-paths/register` (already present for
`ts-node-dev`, see `api/package.json` scripts), so `npm run dev` and
`ts-node` scripts resolve the alias without a build step.

**Mobile side** uses the same pattern inside its own `tsconfig.json`.
The mobile CLAUDE.md captures the rule: "Shared types: import from
`shared/types.ts` (not a published package; reference by relative
path or configure the path in tsconfig)."

The types are a pure-interface boundary. No runtime code lives in
`shared/`. `shared/package.json` exists only so editors pick up the
directory; nothing is published.

## Consequences

**Easier**

- Single source of truth. `FeedItem`, `UserProfile`, `ApiError`,
  `PaginatedResponse<T>`, `ProcessingStatus`, `AscentVisibility`,
  and all domain entities exist in exactly one file. Renaming a
  field on the API is immediately visible as a type error on the
  mobile side.
- Zero runtime overhead. `tsc-alias` rewrites the alias at build
  time, so the compiled output has ordinary relative imports. No
  `tsconfig-paths/register` in production.
- Clean imports. A service can `import type { FeedItem } from
  '@shared/types'` without reasoning about the monorepo layout.

**Harder**

- Build is now `tsc && tsc-alias`, not plain `tsc`. If someone
  reproduces the build incantation by hand and forgets `tsc-alias`,
  the compiled output has unresolvable `@shared/*` specifiers and
  crashes at import time. Mitigation: the `build` script in
  `api/package.json` is the single invocation point, and CI runs it.
- Dev runtime requires `ts-node` to be started with
  `tsconfig-paths/register`. The `dev` and `worker:*` scripts in
  `api/package.json` do this; one-off `ts-node` invocations must
  remember to `-r tsconfig-paths/register`.
- The mobile app and API share a single version of every contract
  type. If we ever need an API to deprecate a field while mobile
  still references it, we need to add the field back or handle the
  breakage with a client version gate. This is the usual monorepo
  trade-off.

## Reversal cost

Low. Swapping `@shared/*` for a published npm package is mechanical:
move `shared/` into its own package, add it as a dependency, and
find-replace the import specifiers. The type definitions themselves
do not change.
