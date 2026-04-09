# Crux E2E Test Plan

## Production Endpoints

- **API**: `https://crux-app-a02ba02ebdf6.herokuapp.com`
- **Supabase**: `https://zmzaunasjxrocwfzspmv.supabase.co`
- **Heroku app**: `crux-app`

---

## 1. Complete Feature List

### A. Authentication (Supabase Auth)
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| A1 | Phone + password registration | Mobile: `(auth)/register.tsx` → Supabase `signUp` |
| A2 | SMS OTP verification | Mobile: `(auth)/verify-phone.tsx` → Supabase `verifyOtp` |
| A3 | Phone + password login | Mobile: `(auth)/login.tsx` → Supabase `signInWithPassword` |
| A4 | Session persistence (SecureStore) | `authStore.ts` → `getSession()` + `onAuthStateChange` |
| A5 | Token refresh on 401 | `api.ts` → auto-refresh with dedup |
| A6 | Sign out | `AccountScreen` → Supabase `signOut` |
| A7 | Delete account | `POST /auth/delete-account` (rate limited: 10/min) |

### B. User Profile
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| B1 | View own profile | `GET /users/me` → `AccountScreen` |
| B2 | Edit profile (display_name, username, avatar, home_gym) | `PATCH /users/me` → `EditProfileScreen` |
| B3 | View other user's profile | `GET /users/:username` → `profile/[username].tsx` |
| B4 | View user's ascent history | `GET /users/:username/ascents` → `ascent-history/[username].tsx` |

### C. Social / Follows
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| C1 | Follow a user | `POST /users/:username/follow` |
| C2 | Unfollow a user | `DELETE /users/:username/follow` |
| C3 | View followers list | `GET /users/:username/followers` → `follow-list.tsx` |
| C4 | View following list | `GET /users/:username/following` → `follow-list.tsx` |
| C5 | Friends list (mutual) | `GET /users/me/friends` → `SearchScreen` |

### D. Feed
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| D1 | Personal feed (friends' ascents) | `GET /feed` → `HomeScreen` (keyset pagination) |
| D2 | Discover feed (public) | `GET /feed/discover` → `SearchScreen` |
| D3 | Gym feed | `GET /feed/gym/:gymId` → `feed/gym.tsx` |
| D4 | Feed pagination (cursor-based) | Cursor param, `has_more` flag |

### E. Gyms
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| E1 | List all gyms | `GET /gyms` → `GymScreen` |
| E2 | Nearby gyms (lat/lng) | `GET /gyms/nearby?lat=&lng=&radius=` |
| E3 | Gym detail | `GET /gyms/:gymId` → `gym/[gymId].tsx` |
| E4 | Gym problems (active) | `GET /gyms/:gymId/problems` |
| E5 | Gym problems (retired) | `GET /gyms/:gymId/problems/retired` |
| E6 | Geocode address | `GET /gyms/geocode?address=` |

### F. Upload & Vision Pipeline
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| F1 | Photo upload (multipart) | `POST /uploads` (rate limited: 20/min) → `RecordScreen` |
| F2 | Poll upload status | `GET /uploads/:uploadId/status` |
| F3 | Confirm match | `POST /uploads/:uploadId/confirm` |
| F4 | Vision processing (BullMQ async) | Worker: vision → hold_vector → similarity search |
| F5 | Auto-match (score >= 0.92) | Status → `matched` |
| F6 | Awaiting confirmation (0.75-0.91) | Status → `awaiting_confirmation` |
| F7 | New problem (< 0.75) | Status → `unmatched`, new problem created |

### G. Ascents
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| G1 | Log an ascent | `POST /ascents` → `log-ascent/[problemId].tsx` |
| G2 | View ascent detail | `GET /ascents/:ascentId` → `ascent/[id].tsx` |
| G3 | Flash vs send logic | Determined at write time (first ascent = flash) |
| G4 | Consensus grade calculation | Median of user grades, recalculated on each ascent |
| G5 | Visibility (public/friends/private) | Privacy filter on feed queries |

### H. Problems
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| H1 | Problem detail | `GET /problems/:problemId` → `problem/[id].tsx` |
| H2 | Problem ascent list | `GET /problems/:problemId/ascents` |
| H3 | Problem retirement (nightly cron) | `POST /internal/run-retirement` / cron at 02:00 UTC |

### I. Disputes
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| I1 | Create dispute | `POST /uploads/:uploadId/dispute` |
| I2 | Vote on dispute | `POST /disputes/:disputeId/vote` |
| I3 | Dispute resolution (>= 3 votes, majority) | Auto-resolves; 'split' creates new problem |

### J. Search
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| J1 | Search users and gyms | `GET /search?q=&type=user\|gym\|all` (min 2 chars) |

### K. Push Notifications
| # | Feature | Endpoint / Screen |
|---|---------|-------------------|
| K1 | Register push token | `POST /push-tokens` |
| K2 | Unregister push token | `DELETE /push-tokens` |

### L. Infrastructure
| # | Feature | Endpoint |
|---|---------|----------|
| L1 | Health check | `GET /health` |
| L2 | Rate limiting (3 tiers) | Global 100/min, auth 10/min, upload 20/min |
| L3 | CORS | Configurable via `CORS_ORIGIN` |
| L4 | Sentry error tracking | `api/src/lib/sentry.ts` |

---

## 2. Edge Cases & Failure Scenarios

### Auth Edges
- E-A1: Register with already-used phone number
- E-A2: Login with wrong password
- E-A3: Submit invalid/expired OTP
- E-A4: Attempt API call with expired JWT (should trigger refresh)
- E-A5: Attempt API call with completely invalid token (should 401)
- E-A6: Double-tap sign out
- E-A7: Delete account then try to use old token

### Profile Edges
- E-B1: Edit profile with duplicate username
- E-B2: Edit profile with empty display name
- E-B3: Upload oversized avatar image
- E-B4: View non-existent user profile (404)
- E-B5: Special characters in username/display_name

### Social Edges
- E-C1: Follow yourself
- E-C2: Follow same user twice (idempotency)
- E-C3: Unfollow user you don't follow
- E-C4: View followers/following of non-existent user
- E-C5: Follower count consistency after follow/unfollow

### Feed Edges
- E-D1: Empty feed (no friends, no ascents)
- E-D2: Pagination with invalid cursor
- E-D3: Feed with private ascents (should be hidden from non-friends)
- E-D4: Very large feed scroll (pagination stability)

### Gym Edges
- E-E1: Nearby gyms with invalid lat/lng
- E-E2: Nearby gyms with zero radius
- E-E3: Non-existent gym ID
- E-E4: Gym with no active problems
- E-E5: Geocode with invalid/empty address

### Upload Edges
- E-F1: Upload with no photos
- E-F2: Upload with invalid colour
- E-F3: Upload with non-existent gym_id
- E-F4: Upload rate limit exceeded (> 20/min)
- E-F5: Poll status of non-existent upload
- E-F6: Confirm match on already-confirmed upload
- E-F7: Confirm match on upload owned by different user

### Ascent Edges
- E-G1: Log ascent for retired problem
- E-G2: Log ascent with invalid grade value
- E-G3: Log duplicate ascent (same user, same problem, same session)
- E-G4: Ascent visibility filtering correctness

### Problem Edges
- E-H1: Problem detail for non-existent problem
- E-H2: Problem with zero ascents (empty stats)
- E-H3: Retirement of already-retired problem

### Dispute Edges
- E-I1: Dispute on non-existent upload
- E-I2: Vote on already-resolved dispute
- E-I3: Same user voting twice on same dispute
- E-I4: Dispute resolution threshold (exactly 3 votes)

### Search Edges
- E-J1: Search with 0 or 1 character (should reject)
- E-J2: Search with special characters / SQL injection attempt
- E-J3: Search with no results
- E-J4: Search type filter (user only, gym only, all)

### Infrastructure Edges
- E-L1: Rate limit recovery (wait and retry)
- E-L2: Database connection under load
- E-L3: Redis connection failure handling
- E-L4: CORS preflight requests
- E-L5: Heroku dyno restart resilience
- E-L6: Supabase connection pool exhaustion

### Mobile-Specific Edges
- E-M1: Deep link to non-existent route (404 screen)
- E-M2: Network loss during upload
- E-M3: App backgrounded during vision polling
- E-M4: Pull-to-refresh on all scrollable screens
- E-M5: Empty states on all list screens
- E-M6: Navigation back stack consistency
- E-M7: Keyboard dismissal on all input screens
- E-M8: Large image rendering in feed cards
- E-M9: Tab switching during loading states

---

## 3. Subagent Orchestration Prompt

### Overview

Three subagents work in concert to E2E test the Crux production app:

1. **Lead Agent** — orchestrates test order, tracks pass/fail, maintains the bug queue
2. **Frontend Tester** — uses the Claude Chrome Extension on the live app to test all mobile/web flows, reports bugs to the Developer
3. **Developer Agent** — receives bugs from Frontend Tester, diagnoses root cause, applies fixes, deploys via Heroku CLI / Supabase CLI

### Agent Definitions

---

#### Agent 1: LEAD (Test Orchestrator)

**Role**: You are the E2E test lead. You coordinate the testing flow, maintain a structured test log, and ensure all features and edge cases from the test plan are covered in priority order.

**Responsibilities**:
1. Read the test plan sections (Features A-L, Edge Cases E-A through E-M) and create a prioritized execution queue
2. Assign test batches to the Frontend Tester in logical groups (auth first, then profile, then social, etc.)
3. Maintain a running test log with format: `[PASS/FAIL/SKIP] Feature-ID: description — notes`
4. When the Frontend Tester reports a bug, add it to the bug queue and notify the Developer
5. After Developer signals a fix is deployed, instruct Frontend Tester to re-test the specific case
6. Track deployment status using: `heroku ps -a crux-app` and `heroku logs --tail -a crux-app`
7. At completion, produce a final summary report with: total tested, passed, failed, fixed, remaining

**Test Priority Order**:
1. Infrastructure (L1: health check) — verify API is reachable
2. Auth flow (A1-A7) — everything depends on auth working
3. Profile (B1-B4) — needed for social features
4. Social (C1-C5) — needed for feed
5. Feed (D1-D4) — core user experience
6. Gyms (E1-E6) — gym browsing
7. Upload & Vision (F1-F7) — core differentiator
8. Ascents (G1-G5) — logging climbs
9. Problems (H1-H3) — problem management
10. Disputes (I1-I3) — conflict resolution
11. Search (J1) — discovery
12. Push notifications (K1-K2) — notifications
13. Edge cases (E-A through E-M) — after happy paths pass

**Communication Protocol**:
- Send test batches to Frontend Tester via: `SendMessage(to: "frontend-tester", ...)`
- Send bug reports to Developer via: `SendMessage(to: "developer", ...)`
- Wait for responses before advancing to next batch

---

#### Agent 2: FRONTEND TESTER

**Role**: You are the frontend QA tester. You test the Crux app through the Claude Chrome Extension, interacting with the production app as a real user would.

**Tools Available**: Claude Chrome Extension (browser automation), API calls via curl for backend verification.

**Production URLs**:
- API Base: `https://crux-app-a02ba02ebdf6.herokuapp.com`
- Supabase: `https://zmzaunasjxrocwfzspmv.supabase.co`

**Responsibilities**:
1. Receive test batches from the Lead agent
2. For each test case:
   a. Execute the user flow (navigate, tap, fill forms, submit)
   b. Verify expected outcomes (correct screens, data displayed, error messages)
   c. Check API responses match expectations (use curl for backend verification)
   d. Record result as PASS or FAIL with screenshot/details
3. When a FAIL is found, immediately report to Lead with:
   - Feature ID and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Any error messages or HTTP status codes
   - Screenshots if available
4. Re-test failed cases after Developer signals fix is deployed

**API Testing Template** (for backend verification):
```bash
# Health check
curl -s https://crux-app-a02ba02ebdf6.herokuapp.com/health | jq .

# Authenticated request template
curl -s https://crux-app-a02ba02ebdf6.herokuapp.com/<endpoint> \
  -H "Authorization: Bearer $TOKEN" | jq .

# Search test
curl -s "https://crux-app-a02ba02ebdf6.herokuapp.com/search?q=test&type=all" | jq .
```

**Reporting Format**:
```
## Test Result: [PASS/FAIL] Feature-ID
- **Steps**: what you did
- **Expected**: what should happen
- **Actual**: what happened
- **Error**: any error messages, HTTP codes
- **Severity**: critical / major / minor
```

---

#### Agent 3: DEVELOPER (Bug Fixer)

**Role**: You are the developer responsible for diagnosing and fixing bugs found during E2E testing. You have access to the codebase, Heroku CLI, and Supabase CLI.

**Tools Available**:
- Full codebase read/write access
- `heroku` CLI (app: `crux-app`)
- `supabase` CLI (project: Crux, ref: `zmzaunasjxrocwfzspmv`)
- Git for version control

**Responsibilities**:
1. Receive bug reports from the Lead agent
2. For each bug:
   a. Diagnose root cause by reading relevant code
   b. Check Heroku logs: `heroku logs --tail -a crux-app`
   c. Check database state if needed: `supabase db` commands or direct query
   d. Implement the fix in the codebase
   e. Test locally if possible
   f. Deploy the fix: `cd api && npm run build && git add . && git commit -m "fix: <description>" && git push heroku main`
   g. Verify deployment: `heroku ps -a crux-app`
   h. Signal to Lead that the fix is deployed and ready for re-test
3. For database/migration issues:
   - `supabase migration new <name>` for schema changes
   - `supabase db push` to apply
4. For environment variable issues:
   - `heroku config:set KEY=VALUE -a crux-app`
5. Keep a fix log with format: `[FIXED] Feature-ID: root cause — fix applied — deploy status`

**Deployment Checklist**:
```bash
# 1. Build
cd api && npm run build

# 2. Check TypeScript
npx tsc --noEmit

# 3. Commit
git add -A && git commit -m "fix: description"

# 4. Deploy
git push heroku main

# 5. Verify
heroku ps -a crux-app
heroku logs --tail -a crux-app --num 50
```

**Supabase Commands**:
```bash
# Check project status
supabase projects list

# Run migration
supabase migration new <name>
supabase db push --project-ref zmzaunasjxrocwfzspmv

# Check database
supabase db remote commit --project-ref zmzaunasjxrocwfzspmv
```

---

## 4. Execution Flow

```
Lead Agent
  |
  |-- [1] Verify infrastructure (health check)
  |       |
  |       +-- Frontend Tester: curl /health → PASS/FAIL
  |
  |-- [2] Auth flow tests (A1-A7)
  |       |
  |       +-- Frontend Tester: register, verify, login, token refresh, logout, delete
  |       |       |
  |       |       +-- (on FAIL) → Lead → Developer: diagnose & fix → redeploy → re-test
  |
  |-- [3] Profile tests (B1-B4)
  |       |
  |       +-- Frontend Tester: view profile, edit profile, view others, ascent history
  |
  |-- [4] Social tests (C1-C5)
  |       |
  |       +-- Frontend Tester: follow, unfollow, view lists, friends
  |
  |-- [5] Feed tests (D1-D4)
  |       |
  |       +-- Frontend Tester: home feed, discover, gym feed, pagination
  |
  |-- [6] Gym tests (E1-E6)
  |       |
  |       +-- Frontend Tester: list gyms, nearby, detail, problems, geocode
  |
  |-- [7] Upload tests (F1-F7)
  |       |
  |       +-- Frontend Tester: photo upload, poll status, confirm match
  |
  |-- [8] Ascent tests (G1-G5)
  |       |
  |       +-- Frontend Tester: log ascent, flash/send, grades, visibility
  |
  |-- [9] Problem tests (H1-H3)
  |       |
  |       +-- Frontend Tester: detail, ascent list, retirement
  |
  |-- [10] Dispute tests (I1-I3)
  |        |
  |        +-- Frontend Tester: create dispute, vote, resolution
  |
  |-- [11] Search tests (J1)
  |        |
  |        +-- Frontend Tester: search users, gyms, filters
  |
  |-- [12] Push token tests (K1-K2)
  |
  |-- [13] Edge case sweep (E-A through E-M)
  |        |
  |        +-- Frontend Tester: all edge cases from Section 2
  |
  |-- [14] Final report
          |
          +-- Lead: compile all results, outstanding bugs, summary
```

---

## 5. Final Report Template

```markdown
# Crux E2E Test Report — [DATE]

## Summary
- **Total test cases**: X
- **Passed**: X
- **Failed**: X
- **Fixed during test**: X
- **Remaining bugs**: X
- **Skipped**: X (with reasons)

## Results by Category
| Category | Total | Pass | Fail | Notes |
|----------|-------|------|------|-------|
| Auth     |       |      |      |       |
| Profile  |       |      |      |       |
| Social   |       |      |      |       |
| Feed     |       |      |      |       |
| Gyms     |       |      |      |       |
| Upload   |       |      |      |       |
| Ascents  |       |      |      |       |
| Problems |       |      |      |       |
| Disputes |       |      |      |       |
| Search   |       |      |      |       |
| Push     |       |      |      |       |
| Infra    |       |      |      |       |
| Edges    |       |      |      |       |

## Bugs Found & Fixed
| ID | Feature | Severity | Root Cause | Fix | Status |
|----|---------|----------|------------|-----|--------|
|    |         |          |            |     |        |

## Outstanding Issues
| ID | Feature | Severity | Description | Assigned |
|----|---------|----------|-------------|----------|
|    |         |          |             |          |

## Deployment Log
| Time | Action | Result |
|------|--------|--------|
|      |        |        |
```
