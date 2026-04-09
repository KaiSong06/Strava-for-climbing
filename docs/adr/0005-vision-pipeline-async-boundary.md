# ADR 0005: Vision pipeline is always async

- **Status:** Accepted
- **Date:** 2026-04-09
- **Deciders:** Engineering team

## Context

When a user logs a climb they snap one or more photos. The photos go
through a 7-stage pipeline:

1. Photo upload to object storage (`uploadBuffer` in
   `api/src/services/storage.ts`).
2. Enqueue of a BullMQ `'vision'` job.
3. (Python worker) SAM ViT-B segmentation to isolate holds.
4. (Python worker) Mask post-processing, centroid extraction.
5. (Python worker) 200-dim hold-vector construction, sorted by y DESC.
6. (Node worker) `POST /uploads/:id/result` writes the vector back onto
   the upload row and runs pgvector ANN similarity search.
7. (Node worker) Based on the top score, the upload transitions to
   `matched` (>= 0.92), `awaiting_confirmation` (0.75–0.91), or
   `unmatched` (< 0.75); a push notification is sent.

End-to-end p95 is 20–30 seconds. The SAM step alone is ~10 seconds with
the ViT-B weights. Cold starts on Fly.io (where the vision service is
deployed) add another ~10 seconds if the machine has scaled to zero.

Two options were on the table:

- **Synchronous**: the mobile `POST /uploads` call blocks until the
  pipeline finishes and returns the match result in the response body.
- **Asynchronous**: the mobile call enqueues a job, returns immediately
  with `{ uploadId, status: 'pending' }`, and the client polls or
  awaits a push notification.

## Decision

The pipeline is always asynchronous. There is no code path in the API
that runs the vision pipeline inline during a request. The route at
`api/src/routes/uploads.ts` is the authoritative version:

```ts
uploadsRouter.post('/', requireAuth, uploadLimiter, parsePhotos, async (req, res, next) => {
  // upload photos → create uploads row → enqueue BullMQ job → return pending
  res.status(201).json({ uploadId, status: 'pending' });
});
```

The state machine lives in `uploads.processing_status`:

```
pending → processing → matched
                     → awaiting_confirmation
                     → unmatched
                     → failed
```

and a `complete` terminal state set by `POST /uploads/:id/confirm` once
the user has confirmed the match or created a new problem.

The mobile client uses two fallbacks for notification:

1. **Primary**: Expo push notification sent by the Node worker when the
   job finishes. `api/src/services/pushService.ts` sends the payload,
   and deep linking in the mobile app drops the user onto the correct
   screen (cold-start aware).
2. **Secondary**: polling `GET /uploads/:id/status` every few seconds.
   This is required because push notifications may not arrive
   (permissions denied, app backgrounded, flaky push infra). The
   polling path is gated by the new partial index
   `idx_uploads_processing_active` added in
   `db/migrations/010_hardening.sql`, which indexes only `(pending,
   processing)` rows so the worker's lookup stays small as the
   `uploads` table grows.

## Consequences

**Easier**

- HTTP connections are not held open for 30 seconds. That matters for
  rate-limit budgets (the `uploadLimiter` is 20 req/min) and for mobile
  retry costs. A mobile client retrying a synchronous 30-second request
  on a flaky connection wastes the user's battery and mobile data.
- Push notifications are the right UX for "your climb is ready to
  confirm" — they are low-friction and work even when the user has
  switched apps.
- The Node API process does not import any ML models. The heavy
  dependencies stay in the Python `vision/` service; the Node worker
  just shuffles JSON (see the vision CLAUDE.md note on model weights).
- Failures retry without client involvement: BullMQ retries 3 times
  with exponential backoff (see ADR 0002) before transitioning the
  upload to `failed` and notifying the user.

**Harder**

- A state machine with six terminal/non-terminal states is more
  surface area than a boolean return value. Every mobile screen that
  renders an upload has to handle all of them; the `useVisionPipeline`
  hook (`mobile/src/hooks/useVisionPipeline.ts`) is the single owner
  of that logic.
- The polling fallback must not hammer the API. The client uses a
  backoff schedule and a poll timeout (documented in the mobile
  CLAUDE.md / recent git commit `da64429`).
- "What happened to my upload?" support questions require reading
  `uploads.processing_status`, the worker logs in Sentry, and possibly
  the BullMQ failed-jobs ring. We accept this operational cost in
  exchange for not pinning an HTTP connection to an ML job.

## Reversal cost

Medium. Making this synchronous would mean tearing out the BullMQ queue
entirely and folding the pipeline steps back into the route handler.
The real cost of reversal is the UX regression (30-second perceived
latency); the code change itself is local.
