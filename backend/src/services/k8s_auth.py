"""Compatibility helpers for kubernetes_asyncio authentication (meeting-joiner port)."""

import inspect
from typing import Any

from kubernetes_asyncio import client


def _sync_bearer_token_alias(configuration: client.Configuration) -> None:
    """Mirror legacy in-cluster auth key to the generated client's key."""
    token = configuration.api_key.get("authorization")
    if not token:
        return

    configuration.api_key["BearerToken"] = token
    if token.lower().startswith("bearer "):
        configuration.api_key_prefix.pop("BearerToken", None)
    else:
        configuration.api_key_prefix["BearerToken"] = "Bearer"


def build_authenticated_api_client() -> client.ApiClient:
    """Create an ApiClient that works with kubernetes_asyncio 36 in-cluster auth.

    kubernetes_asyncio 36.0.0's in-cluster config loader stores the service
    account token under ``authorization``, while the generated client only reads
    ``BearerToken``.  Mirror the key and preserve token refresh behavior.
    """
    configuration = client.Configuration.get_default_copy()
    _sync_bearer_token_alias(configuration)

    refresh_api_key_hook = configuration.refresh_api_key_hook
    if refresh_api_key_hook is not None:

        def refresh_and_sync(config_obj: client.Configuration) -> Any:
            result = refresh_api_key_hook(config_obj)
            if inspect.isawaitable(result):

                async def await_and_sync() -> None:
                    await result
                    _sync_bearer_token_alias(config_obj)

                return await_and_sync()

            _sync_bearer_token_alias(config_obj)
            return result

        configuration.refresh_api_key_hook = refresh_and_sync

    return client.ApiClient(configuration)
