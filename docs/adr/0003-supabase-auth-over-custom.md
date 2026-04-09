# ADR 0003: Supabase Auth over custom auth / Auth0 / Clerk

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

Crux is a social app. Accounts are phone-based (no anonymous accounts, no
email passwords), because phone numbers bind an account to a real human
and make follow-graph Sybil attacks meaningfully harder. The ask was:

- Phone + password sign-up.
- SMS OTP verification on first login.
- Sessions issued as JWTs, verifiable on the API without a database
  round-trip.
- Sessions persisted across mobile app reinstalls (SecureStore).
- Canada-only phone numbers for MVP.

The options:

- **Build our own** with a phone column on `users`, a password hash,
  Twilio for SMS, and a hand-rolled JWT layer.
- **Auth0** or **Clerk** — managed, but expensive per MAU and heavier on
  integration.
- **Supabase Auth** — built into Supabase; we were already using Supabase
  Postgres for pgvector (ADR 0001) and Supabase Storage for photos.

The single most expensive part of custom auth here is not password
hashing (everyone knows how to bcrypt). It's the OTP flow: provisioning
Twilio, keeping the verification code store secure, rate limiting by
phone to avoid toll fraud, translating provider errors back to the
client. All of that is infrastructure we did not want to own for MVP.

## Decision

Use Supabase Auth for phone + password + SMS OTP via Twilio. The API
never hashes passwords, never sends SMS, and never stores OTPs. It only
verifies incoming Bearer tokens.

Implementation:

- Mobile (`mobile/src/lib/supabase.ts`) calls the Supabase JS SDK
  directly for `signUp`, `signInWithPassword`, `verifyOtp`, `signOut`.
- Session is persisted via Expo SecureStore (custom adapter plugged
  into the Supabase client).
- The API (`api/src/middleware/auth.ts`) validates Supabase JWTs via
  JWKS. `createRemoteJWKSet` from `jose` fetches
  `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`; tokens are ES256
  (asymmetric) so the API has no shared secret to leak.
- `requireAuth` attaches `req.user.userId` (from the JWT `sub` claim).
  `optionalAuth` does the same without rejecting on failure.
- A Postgres trigger, `on_auth_user_created` (tracked in
  `db/migrations/011_auth_trigger.sql`), auto-inserts a `public.users`
  row whenever Supabase creates an `auth.users` row. The migration is
  guarded on the presence of the `auth` schema so local/test
  environments (which ship plain pgvector containers) apply it as a
  no-op.

Phone numbers are stored in E.164 format with a `UNIQUE` constraint.
The mobile UI collects 10 digits and the client prepends `+1`. Making
the prefix a client-side concern keeps the schema internationalisable
without a migration once we expand beyond Canada.

## Consequences

**Easier**

- Zero SMS-provider code. No Twilio secrets in API env vars. No
  rate-limit logic to keep toll fraud under control on our side.
- JWKS verification means the API scales horizontally without sharing a
  secret and without a session database.
- The `POST /auth/delete-account` endpoint at
  `api/src/routes/auth.ts` is the only auth route we ship — it just
  cleans up `public.*` rows then calls
  `supabaseAdmin().auth.admin.deleteUser`.
- No `requireVerified` middleware; Supabase refuses to issue a session
  until the OTP is verified, so verification is implicit.

**Harder**

- Coupled to Supabase for the foreseeable future. Migrating off means a
  data migration of `auth.users` (password hashes are stored in Supabase,
  not accessible to us), an invalidate-all-sessions moment, and
  potentially a forced re-verification via SMS for every active user.
- Local dev requires either pointing at a Supabase project or skipping
  auth — the JWKS endpoint cannot be faked cheaply. The test harness
  installs a JWKS mock via `api/src/test/fakeJwks.ts`.

## Reversal cost

High. Changing auth providers is the kind of migration that needs to be
announced to users and staged over days. We accept that as the price of
not owning OTP infrastructure during the MVP phase.
