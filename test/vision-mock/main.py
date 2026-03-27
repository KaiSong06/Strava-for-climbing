"""
Mock vision service for E2E testing.
Returns deterministic canned hold_vectors based on the colour parameter.

Scenarios (all at gym 11111111-0000-0000-0000-000000000001):
  #FF0000 (red)  → vector identical to seeded red problem   → auto-match   (≥ 0.92)
  #0000FF (blue) → vector partially overlapping seeded blue → confirm      (0.75–0.91)
  any other      → no seeded problems of that colour exist   → new problem  (< 0.75)
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="Crux Vision Mock")

# ── Canned vectors (200 dims, zero-padded) ──────────────────────────────────
#
# Red: exactly matches the seeded red problem → cosine similarity = 1.0
# 5 holds at (0.2,0.9), (0.3,0.7), (0.5,0.5), (0.7,0.3), (0.8,0.1)
RED_VECTOR = [0.2, 0.9, 0.3, 0.7, 0.5, 0.5, 0.7, 0.3, 0.8, 0.1] + [0.0] * 190
#
# Blue: partially overlaps the seeded blue problem → cosine similarity ≈ 0.84
# Seeded blue has 3 holds: (0.4,0.8), (0.5,0.5), (0.6,0.2)
# Mock returns 4 holds:    (0.4,0.8), (0.5,0.5), (0.3,0.3), (0.7,0.1)
BLUE_VECTOR = [0.4, 0.8, 0.5, 0.5, 0.3, 0.3, 0.7, 0.1] + [0.0] * 192
#
# Default: arbitrary vector — no seeded problems of other colours exist,
# so the worker finds 0 candidates and the upload goes to "new problem".
DEFAULT_VECTOR = [0.1, 0.1, 0.9, 0.9, 0.1, 0.5, 0.9, 0.5] + [0.0] * 192

VECTORS: dict[str, tuple[list[float], int]] = {
    "#FF0000": (RED_VECTOR, 5),
    "#0000FF": (BLUE_VECTOR, 4),
}


class ProcessRequest(BaseModel):
    upload_id: str
    photo_urls: list[str]
    colour: str
    gym_id: str


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/process")
def process(body: ProcessRequest) -> dict:
    vector, hold_count = VECTORS.get(body.colour, (DEFAULT_VECTOR, 4))
    return {
        "hold_vector": vector,
        "hold_count": hold_count,
        "wall_bbox": {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0},
        "debug_image_url": None,
    }
