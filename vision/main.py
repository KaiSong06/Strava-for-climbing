"""
Crux Vision Service
FastAPI app — entry point for uvicorn.
All heavy ML work happens in workers/vision_worker.py via Redis job queue.
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse

load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    print("[vision] service starting")
    yield
    print("[vision] service shutting down")


app = FastAPI(title="Crux Vision Service", lifespan=lifespan)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})
