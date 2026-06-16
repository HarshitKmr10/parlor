"""Shared singletons (provider router + embedding store) and FastAPI deps.

These are populated during the app lifespan and accessed by route handlers via
dependency functions.
"""

from __future__ import annotations

from .config import settings
from .providers import ProviderRouter
from .rag import EmbeddingStore

router_singleton: ProviderRouter = ProviderRouter(settings)
store_singleton: EmbeddingStore = EmbeddingStore(settings.database_url)


def get_router() -> ProviderRouter:
    return router_singleton


def get_store() -> EmbeddingStore:
    return store_singleton
