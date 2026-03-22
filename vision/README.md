# Crux Vision Service

FastAPI service that processes climbing photos to extract hold positions and produce a `hold_vector` for pgvector similarity matching.

## Model weights

Weights are **not** committed to git. Download them once into `vision/models/` before running the service.

```bash
mkdir -p vision/models

# SAM ViT-B checkpoint (~375 MB)
curl -L -o vision/models/sam_vit_b_01ec64.pth \
  https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth

# MiDaS small is fetched automatically by torch.hub on first startup (~100 MB).
# It is cached in ~/.cache/torch/hub/ — no manual download needed.
```

## Setup

```bash
cd vision
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running

```bash
# HTTP service (models load at startup — allow ~10s for cold start)
uvicorn main:app --reload --port 8000
```

The TypeScript BullMQ worker (`api/src/jobs/visionWorker.ts`) calls `POST /process` on this service. You do **not** run a separate Python worker process anymore.

## Environment variables

Copy `.env.example` to `.env` and fill in values:

| Variable                    | Default                   | Description                              |
|-----------------------------|---------------------------|------------------------------------------|
| `REDIS_URL`                 | `redis://localhost:6379`  | Redis (kept for legacy; not used by service) |
| `API_URL`                   | `http://localhost:3001`   | Backend API URL                          |
| `SIMILARITY_THRESHOLD_AUTO` | `0.92`                    | Auto-match threshold                     |
| `SIMILARITY_THRESHOLD_CONFIRM` | `0.75`                 | Confirm-match threshold                  |

## Deployment

Deploy to Railway or Render (free tier handles ~2GB RAM for MiDaS + SAM ViT-B).
Set `VISION_SERVICE_URL` in the API's environment to point at the deployed URL.

MiDaS + SAM ViT-B together use 4–6 GB RAM — **do not** deploy to Heroku standard dynos (512 MB cap).
