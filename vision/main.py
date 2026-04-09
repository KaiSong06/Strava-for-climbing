"""
Crux Vision Service
FastAPI app — entry point for uvicorn.

Models (SAM ViT-B, MiDaS small) are loaded once at startup and reused across
all requests. Cold start takes ~10s; never reload per request.

Run: uvicorn main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from workers.vision_worker import load_midas_model, load_sam_model, process_upload

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("[vision] loading models…")
    app.state.sam = load_sam_model()
    app.state.midas, app.state.midas_transform = load_midas_model()
    logger.info("[vision] models ready")
    yield
    logger.info("[vision] shutting down")


app = FastAPI(title="Crux Vision Service", lifespan=lifespan)


# ── Request / response models ──────────────────────────────────────────────────


class ProcessRequest(BaseModel):
    upload_id: str
    photo_urls: list[str]
    colour: str
    gym_id: str


class WallBbox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class ProcessResponse(BaseModel):
    hold_vector: list[float]
    hold_count: int
    wall_bbox: WallBbox
    debug_image_url: str | None
    model_glb_base64: str | None


# ── Endpoints ──────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/process", response_model=ProcessResponse)
def process(body: ProcessRequest, request: Request) -> Any:
    """
    Run the vision pipeline on uploaded photos and return a hold_vector.
    Runs synchronously in FastAPI's thread pool (CPU-bound; do not make async).
    """
    sam_model: Any = request.app.state.sam
    midas_model: Any = request.app.state.midas
    midas_transform: Any = request.app.state.midas_transform

    try:
        result = process_upload(
            upload_id=body.upload_id,
            photo_urls=body.photo_urls,
            colour=body.colour,
            gym_id=body.gym_id,
            sam_model=sam_model,
            midas_model=midas_model,
            midas_transform=midas_transform,
        )
    except RuntimeError as exc:
        stage = str(exc)
        logger.exception("[vision] pipeline failed: %s", stage)
        return JSONResponse(
            status_code=500,
            content={"error": stage, "detail": repr(exc.__cause__)},
        )
    except Exception as exc:
        logger.exception("[vision] unexpected error for upload %s", body.upload_id)
        return JSONResponse(
            status_code=500,
            content={"error": "pipeline_failed", "detail": repr(exc)},
        )

    return result
