# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in the `vision/` directory.

## Overview

Python FastAPI service that runs the computer vision pipeline for hold detection. Receives photo URLs, returns a 200-dim hold vector for pgvector similarity search. Called by the TypeScript BullMQ worker (not directly by mobile or API routes).

## Commands

```bash
uvicorn main:app --reload --port 8000    # dev server (models load at startup, ~10s cold start)
docker build -t crux-vision .            # build Docker image
```

## Model Setup

Download SAM ViT-B weights before first run:
```bash
curl -L -o models/sam_vit_b_01ec64.pth https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth
```
MiDaS small is auto-cached by `torch.hub` on first startup.

## Endpoints

- `GET /health` — returns `{"status": "ok"}`
- `POST /process` — runs the 7-stage pipeline, returns `{hold_vector, hold_count, wall_bbox, debug_image_url, model_glb_base64}`

## 7-Stage Pipeline (`workers/vision_worker.py`)

1. **Image Loading** — download from S3, decode RGB, resize longest side to 1080px
2. **HSV Colour Segmentation** — hex → HSV, tolerance ±15 hue / ±30% sat/val, hue wraparound for reds
3. **Hold Instance Segmentation** — connected components on colour mask → SAM ViT-B point prompts (max 50), filter by area (400px–15% of image), extract centroids
4. **Wall Boundary Detection** — Canny edges → Hough lines → 5th/95th percentile bbox, fallback to full frame
5. **Coordinate Normalisation** — pixel centroids → [0,1] relative to wall bbox, y inverted (0=floor, 1=top), deduplicate (threshold 0.03), sort y DESC, zero-pad to 200 dims
6. **Depth Estimation + 3D Model** — MiDaS small runs on the first photo to produce a depth map; `_generate_glb_model()` builds a relief mesh (subsampled ~270x270 grid), UV-maps the wall photo as a 512x512 JPEG texture, adds hold marker spheres, and exports as GLB via `trimesh`. Non-fatal: failure falls back to `model_glb_base64 = null`.
7. **Return Result** — dict consumed by /process endpoint; includes `model_glb_base64` (base64-encoded GLB binary, 500KB–2MB typical)

## Key Constraints

- Models load **once at startup** via FastAPI lifespan context — never per-request
- SAM's `set_image()` is called once per photo (caches the image encoder output)
- Pipeline is CPU-bound, runs synchronously in FastAPI's thread pool
- Max 50 connected components processed per image (sorted by area DESC)
- Hold area filter: minimum 400px, maximum 15% of total image area

## Deployment

Fly.io (`fly.toml`): region `yyz`, 2 CPUs / 4 GB RAM, min 0 machines (scales to zero). Internal port 8000.

## Observability

The service uses `sentry-sdk[fastapi]` for structured logging and error tracking. `sentry_sdk.init()` runs at module import time in `main.py` only when `SENTRY_DSN` is set; otherwise it is a no-op and stdlib logging still works normally.

- `FastApiIntegration` captures request spans and unhandled exceptions automatically.
- `LoggingIntegration(level=INFO, event_level=ERROR)` forwards every `logger.info` call as a Sentry log event and every `logger.error/exception` as an error event — so production code uses stdlib `logging` rather than calling Sentry directly.
- `_experiments={"enable_logs": True}` enables the experimental Sentry Log API in SDK v2.18.
- Pipeline stages use `logger.info("vision.stage.<name>.start/complete", extra={...})` for structured event names. Each stage's `try/except` block calls `sentry_sdk.capture_exception(exc)` with a `vision_pipeline` context tag before re-raising.
- **Never log** raw photo bytes, full S3 URLs with signatures, or user-identifying metadata beyond `upload_id` / `gym_id`.

Relevant env vars:

- `SENTRY_DSN` — DSN for the vision Sentry project (optional; if unset, Sentry is skipped entirely).
- `ENVIRONMENT` — defaults to `development`, set to `production` on Fly.io.

## Architecture Note

The vision service is stateless and HTTP-only. It does NOT read from Redis or the database. The TypeScript BullMQ worker (`api/src/jobs/visionWorker.ts`) orchestrates the flow: dequeue job → call this service → store result in Postgres → update upload status → send push notification.
