# ADR 0002: BullMQ over Temporal / SQS / Inngest

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

The vision pipeline is a linear, 5–30 second job that runs once per upload:

1. Download photos from storage.
2. Run SAM ViT-B segmentation (Python, GPU-optional).
3. Compute hold centroids.
4. Build a 200-dim zero-padded hold vector.
5. Call back into the API to persist the vector on the upload row.
6. Run pgvector ANN similarity against candidate problems.
7. Decide: matched / awaiting_confirmation / unmatched and send a push
   notification.

The API side of this flow lives in `api/src/jobs/visionWorker.ts`. The
Python side lives in `vision/workers/vision_worker.py`. They communicate
over HTTP (the worker POSTs `/process` on the Python service and POSTs the
result back to `/uploads/:id/result` on the Node API — see
`CLAUDE.md` root § "Architecture rules").

We considered four queue options:

- **Temporal** — workflow-as-code, durable execution, audit trail.
- **AWS SQS** — managed, cheap, requires a separate scheduler.
- **Inngest** — managed, event-driven, nice DX.
- **BullMQ on Redis** — in-process producer, external worker process,
  Redis already present.

Redis was already in the stack for rate limiting and session-adjacent
caching. There was no other piece of infrastructure to "re-use" by
picking SQS or Temporal.

## Decision

Use BullMQ on Redis for the `'vision'` queue. Configuration lives in
`api/src/jobs/queue.ts`; the worker lives in `api/src/jobs/visionWorker.ts`
and runs as a separate process (`npm run worker:vision`, also a
dedicated container in `docker-compose.yml`). Retry policy: 3 attempts
with exponential backoff starting at 5 seconds. Completed jobs are
retained for the last 100; failed jobs for the last 500.

Docker Compose runs four services: `redis`, `api`, `vision`, and
`vision-worker` (a separate container from the same `api` image that
only runs the BullMQ worker and depends on both `redis` and `vision`).

## Consequences

**Easier**

- One fewer service in the stack. Temporal wants a separate server,
  history store, matching service, and frontend — operationally a
  significant new surface area for a single queue.
- No vendor lock-in. BullMQ is an npm package; Redis is a commodity.
- The worker state machine is trivial: `pending → processing →
  (matched | awaiting_confirmation | unmatched | failed)`, tracked in
  `uploads.processing_status`. This fits a single queue job far better
  than it fits a Temporal workflow.
- Exponential backoff at 5s × 3 attempts is comfortably enough. The
  longest step (SAM segmentation) takes ~10s; the pipeline as a whole
  finishes in ~30s p95. If it hasn't succeeded after three retries the
  problem is either a bad photo or a broken dependency, and surfacing
  the failure to the user is the right outcome.

**Harder**

- No cross-job workflow orchestration. If Crux ever needs "wait for the
  3D model job to finish, then kick off a composite-render job for 5
  gyms at once", BullMQ's primitives (flows, queue events) will get
  awkward. At that scale we would re-evaluate Temporal.
- No audit trail beyond BullMQ's `completed`/`failed` ring buffers.
  We rely on Sentry structured logs (see ADR 0006) for forensic trails.
- Requires an always-on Redis. We already needed one; this ADR does not
  change that calculus.

## Reversal cost

Medium. The queue contract (`visionQueue.add('process', { uploadId, … })`)
is small and well-encapsulated. Swapping BullMQ for Temporal / SQS means
rewriting `api/src/jobs/queue.ts` and `api/src/jobs/visionWorker.ts` but
leaves the HTTP handoff to the Python vision service untouched.
