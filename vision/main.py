"""
Crux Vision Service
FastAPI app — entry point for uvicorn.

Models (SAM ViT-B, MiDaS small) are loaded once at startup and reused across
all requests. Cold start takes ~10s; never reload per request.

Run: uvicorn main:app --reload --port 8000
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import sentry_sdk
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

from workers.vision_worker import load_midas_model, load_sam_model, process_upload

load_dotenv()

# ── Sentry structured logging / error tracking ───────────────────────────────
#
# When SENTRY_DSN is unset (local dev without tracking), sentry_sdk.init() is
# still safe to call with an empty DSN — it falls back to a no-op transport.
# The LoggingIntegration forwards every `logging.INFO+` record to Sentry as a
# structured log event, and every `logging.ERROR+` record as an exception.
_sentry_dsn = os.environ.get("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("ENVIRONMENT", "development"),
        traces_sample_rate=0.2,
        _experiments={"enable_logs": True},
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
    )

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("vision.models.loading")
    app.state.sam = load_sam_model()
    app.state.midas, app.state.midas_transform = load_midas_model()
    logger.info("vision.models.ready")
    yield
    logger.info("vision.shutdown")


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
        logger.exception(
            "vision.pipeline_failed",
            extra={"stage": stage, "upload_id": body.upload_id, "gym_id": body.gym_id},
        )
        return JSONResponse(
            status_code=500,
            content={"error": stage, "detail": repr(exc.__cause__)},
        )
    except Exception as exc:
        logger.exception(
            "vision.pipeline_unexpected_error",
            extra={"upload_id": body.upload_id, "gym_id": body.gym_id},
        )
        return JSONResponse(
            status_code=500,
            content={"error": "pipeline_failed", "detail": repr(exc)},
        )

    return result
