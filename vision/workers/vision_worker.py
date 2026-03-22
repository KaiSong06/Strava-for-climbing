"""
Vision pipeline worker.
Dequeues jobs from Redis and runs the photo-matching pipeline.

Pipeline stages (all TODO — stub only):
  1. Download photos from S3
  2. Segment holds using SAM ViT-B
  3. Estimate depth with MiDaS (adds z-coordinate to each hold centroid)
  4. Build hold_vector: sort centroids y-desc, take (x, y) pairs, pad to 200 dims
  5. Query pgvector: filter by gym_id + colour, run ANN cosine similarity
  6. Apply threshold logic:
       score >= SIMILARITY_THRESHOLD_AUTO   → auto-match
       score >= SIMILARITY_THRESHOLD_CONFIRM → prompt user to confirm
       score < SIMILARITY_THRESHOLD_CONFIRM  → new problem
  7. POST result back to API (/uploads/:id/result)
"""
import os

# NOTE: Do NOT import torch/transformers at module level — models are loaded
# lazily on first job to avoid slow startup and allow the HTTP service to boot.

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
API_URL = os.getenv("API_URL", "http://localhost:3001")
SIMILARITY_THRESHOLD_AUTO = float(os.getenv("SIMILARITY_THRESHOLD_AUTO", "0.92"))
SIMILARITY_THRESHOLD_CONFIRM = float(os.getenv("SIMILARITY_THRESHOLD_CONFIRM", "0.75"))


def process_upload(job_data: dict) -> None:  # type: ignore[type-arg]
    """
    Main pipeline entry point. Called by the Redis worker for each job.

    Args:
        job_data: {
            uploadId: str,
            userId: str,
            gymId: str,
            colour: str,
            photoUrls: list[str],
        }
    """
    upload_id: str = job_data["uploadId"]
    gym_id: str = job_data["gymId"]
    colour: str = job_data["colour"]
    photo_urls: list[str] = job_data["photoUrls"]

    print(f"[worker] processing upload {upload_id} gym={gym_id} colour={colour}")

    # ── Stage 1: Download photos ───────────────────────────────────────────────
    # TODO: download each url in photo_urls from S3 to a temp dir

    # ── Stage 2: Segmentation (SAM ViT-B) ────────────────────────────────────
    # TODO: load SAM model lazily (heavy)
    # TODO: run segment-anything on each image, extract hold masks + centroids

    # ── Stage 3: Depth estimation (MiDaS) ────────────────────────────────────
    # TODO: load MiDaS model lazily (heavy)
    # TODO: for each centroid, sample depth map to get z value

    # ── Stage 4: Build hold_vector ────────────────────────────────────────────
    # Sort centroids by y-desc (top of wall first) for consistent ordering.
    # Take (x, y) per hold → flatten → zero-pad to 200 dims (100 holds × 2).
    # TODO: implement vectorise(centroids) → list[float] of len 200

    # ── Stage 5: ANN similarity search ───────────────────────────────────────
    # Always pre-filter by gym_id AND colour before running ANN to shrink
    # the candidate set (pgvector index works best on small subsets).
    # TODO: call API to run vector similarity query

    # ── Stage 6: Threshold decision ──────────────────────────────────────────
    # TODO: compare top similarity_score against thresholds and determine outcome

    # ── Stage 7: Post result back to API ─────────────────────────────────────
    # TODO: POST /uploads/{upload_id}/result with { problemId, similarityScore, action }

    raise NotImplementedError("Vision pipeline not yet implemented")


if __name__ == "__main__":
    # TODO: start Redis consumer loop (e.g. rq or raw redis BLPOP on 'bull:vision:wait')
    print("[worker] starting (stub — no jobs will be processed)")
