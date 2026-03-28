# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `test/` directory.

## Overview

E2E test environment using Docker Compose. Runs a complete isolated stack with a mock vision service that returns deterministic responses — no ML models needed.

## Commands

```bash
# Start the full test environment
docker compose -f docker-compose.test.yml up --build

# Run test scenarios (no photos required)
./test/enqueue-test-job.sh red     # auto-match (score >= 0.92)
./test/enqueue-test-job.sh blue    # awaiting_confirmation (0.75–0.91)
./test/enqueue-test-job.sh green   # new problem (< 0.75)

# Check results
docker compose -f docker-compose.test.yml exec postgres \
  psql -U crux -d crux -c \
  "SELECT id, processing_status, similarity_score, problem_id FROM uploads ORDER BY created_at DESC;"
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| postgres (pgvector:pg16) | 5433 | Test database, initialized with all migrations + seed_test.sql |
| redis (7-alpine) | 6380 | Job queue |
| minio | 9000 (API), 9001 (console) | S3-compatible storage (buckets: problems, avatars) |
| vision-mock | 8001 | Deterministic canned responses (no ML) |
| api | 3001 | Full API server |
| vision-worker | — | BullMQ worker processing vision jobs |

## Mock Vision Service (`vision-mock/`)

Returns fixed 200-dim hold vectors based on colour input:
- `#FF0000` (red) → exact match to seeded problem → cosine 1.0 → auto-match
- `#0000FF` (blue) → partial match → cosine ~0.84 → awaiting_confirmation
- Any other colour → unrelated vector → no match → new problem

## Test Data (`../db/seeds/seed_test.sql`)

- 1 gym, 1 test user, 2 seeded problems (red, blue) with hold vectors matching the mock responses
- The green scenario works because no seeded problem matches the default vector

## How `enqueue-test-job.sh` Works

1. Generates a UUID for the upload
2. Inserts an upload row directly into Postgres (via `docker compose exec`)
3. Enqueues a BullMQ job via Node.js runtime in the API container
4. The vision-worker picks it up, calls the mock service, and updates the upload status

This bypasses photo upload entirely — useful for testing the pipeline without actual images.
