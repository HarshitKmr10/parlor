"""FastAPI application entrypoint for the AI microservice.

Internal HTTP service (not public). Boots in mock mode without any API keys so
the wider system runs in dev. Exposes GET /health plus POST /summarize,
/embed, /chat per docs/API-CONTRACT.md.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings
from .dependencies import get_router, get_store, store_singleton
from .routes import insights_router
from .schemas import HealthResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "starting ai-service (mode=%s, provider_order=%s)",
        settings.mode,
        ",".join(settings.provider_order),
    )
    await store_singleton.init()
    yield
    await store_singleton.close()


app = FastAPI(
    title="Meeting SaaS AI Service",
    version="1.0.0",
    description="Summaries, embeddings, and chat-with-meeting (RAG).",
    lifespan=lifespan,
)


# --- Structured error envelopes --------------------------------------------


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail and "message" in detail:
        body = {"error": detail}
    else:
        body = {"error": {"code": f"http_{exc.status_code}", "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed.",
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Internal server error."}},
    )


# --- Health ----------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, response_model_by_alias=True)
async def health() -> HealthResponse:
    store = get_store()
    provider_router = get_router()
    if not store.configured:
        db_status = "unconfigured"
    elif store.ready:
        db_status = "ready"
    else:
        db_status = "unavailable"
    return HealthResponse(
        status="ok",
        mode=settings.mode,
        provider_order=settings.provider_order,
        providers_available=provider_router.available,
        database=db_status,
    )


app.include_router(insights_router)
