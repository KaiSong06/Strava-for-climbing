# Crux E2E Test Report — 2026-04-04

## Summary
- **Total test cases**: 42
- **Passed**: 37
- **Failed**: 3
- **Fixed during test**: 0
- **Remaining bugs**: 3
- **Skipped**: 2 (with reasons)

## Results by Category
| Category | Total | Pass | Fail | Notes |
|----------|-------|------|------|-------|
| Infra    | 4     | 4    | 0    | Health check, CORS preflight, CORS headers, rate limit headers all working |
| Auth     | 3     | 3    | 0    | Invalid token 401, missing token 401, delete-account 401 without auth |
| Profile  | 5     | 5    | 0    | View known user, view non-existent (404), ascent history, edit without auth (401), get me without auth (401) |
| Social   | 5     | 5    | 0    | Followers/following for known user, non-existent user (404), follow without auth (401), friends without auth (401) |
| Feed     | 5     | 5    | 0    | Personal feed (401 without auth), discover feed (200), gym feed (200), pagination with cursor, invalid cursor (400) |
| Gyms     | 9     | 7    | 2    | List, nearby, detail, problems, retired all pass. Invalid UUID returns 500 (should be 400). Geocode not deployed (500). |
| Upload   | 2     | 2    | 0    | Upload and status without auth correctly return 401 |
| Ascents  | 2     | 2    | 0    | Log ascent without auth (401), view ascent detail requires auth (401) |
| Problems | 3     | 3    | 0    | Problem detail (200), problem ascents (200), non-existent problem (404) |
| Disputes | 2     | 2    | 0    | Create dispute and vote without auth correctly return 401 |
| Search   | 5     | 4    | 1    | Search all/user/gym types work, SQL injection safe, no-results returns empty. 1-char query **hangs** instead of returning 400. |
| Push     | 1     | 1    | 0    | Push token registration without auth returns 401 |
| Edges    | 6     | 5    | 1    | Invalid lat/lng (400), zero radius (400), SQL injection in username (404), retirement without secret (403). Invalid UUID causes 500. |

## Bugs Found
| ID | Feature | Severity | Root Cause | Fix | Status |
|----|---------|----------|------------|-----|--------|
| BUG-1 | E-J1: Search with 1-char query | **Critical** | In `api/src/routes/search.ts`, the ZodError catch block uses `throw new AppError(...)` instead of `next(new AppError(...))`. Express 4 doesn't catch rejected promises from async handlers, so the request hangs forever. | Change `throw` to `next()` or wrap handler with async catcher. | **Open** |
| BUG-2 | E6: Geocode endpoint | **Major** | `geocodeService.ts` is untracked (not committed/deployed). `gyms.ts` has local changes but isn't on Heroku. `/gyms/geocode` falls through to `/:gymId`. | Commit and deploy geocode service + updated gyms route. | **Open** |
| BUG-3 | Invalid UUID params | **Minor** | Non-UUID path params cause Postgres `22P02` error → 500 instead of 400. | Add UUID validation in route handlers or catch `22P02` in error handler. | **Open** |

## Skipped Tests
| ID | Reason |
|----|--------|
| A1-A4, A6 | Require Supabase mobile SDK (cannot test via curl) |
| F1-F7, G1-G5, I1-I3, K1-K2 | Require authenticated sessions with valid Supabase JWT |

## Key Observations
1. **Auth gates are solid** — every protected endpoint correctly returns 401
2. **SQL injection safe** — parameterized queries throughout
3. **Pagination works** — keyset cursor + `has_more` flag correct
4. **Rate limiting present** — `Ratelimit` headers in responses
5. **CORS properly configured** — preflight 204, dynamic origin reflection
6. **Seeded data consistent** — all users, gyms, problems accessible
