"""Developer webhooks management API (workspace-scoped).

GET    /api/v1/webhooks/events                       available event catalog
POST   /api/v1/webhooks                              register an endpoint
GET    /api/v1/webhooks                              list endpoints
GET    /api/v1/webhooks/{id}                         get one
PATCH  /api/v1/webhooks/{id}                         update
DELETE /api/v1/webhooks/{id}                         delete
POST   /api/v1/webhooks/{id}/test                    enqueue a test delivery
GET    /api/v1/webhooks/{id}/deliveries              delivery log
POST   /api/v1/webhooks/deliveries/{id}/redeliver    requeue a delivery
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ...webhooks import EVENT_TYPES, WebhooksRepo, generate_secret
from ...webhooks.events import is_known_event
from ...webhooks.safety import InvalidWebhookUrl, validate_webhook_url
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_context, get_db
from .errors import ApiError
from .schemas import (
    WebhookDelivery,
    WebhookDeliveryListResponse,
    WebhookEndpoint,
    WebhookEndpointCreate,
    WebhookEndpointUpdate,
    WebhookEventCatalog,
)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> WebhooksRepo:
    return WebhooksRepo(db)


def _validate_url(url: str) -> str:
    try:
        return validate_webhook_url(url)
    except InvalidWebhookUrl as exc:
        raise ApiError(400, "invalid_webhook_url", str(exc))


def _validate_events(event_types: list[str]) -> None:
    unknown = [e for e in event_types if not is_known_event(e)]
    if unknown:
        raise ApiError(
            400, "unknown_event_type", f"Unknown event types: {', '.join(unknown)}"
        )


@router.get(
    "/events",
    response_model=WebhookEventCatalog,
    summary="List available webhook event types",
    description="Returns the catalog of event types an endpoint can subscribe to (e.g. `meeting.completed`, `summary.ready`).",
)
async def list_events(
    _: AuthContext = Depends(get_current_context),
) -> WebhookEventCatalog:
    return WebhookEventCatalog(event_types=list(EVENT_TYPES))


@router.post(
    "",
    response_model=WebhookEndpoint,
    status_code=201,
    summary="Register a webhook endpoint",
    description=(
        "Registers an HTTPS endpoint to receive signed event deliveries. "
        "The URL must be `https://` and passes an SSRF guard (rejects "
        "localhost/private/loopback/link-local addresses). An empty "
        "`eventTypes` list (the default) subscribes to every event. The "
        "signing secret is generated server-side and returned once here."
    ),
)
async def create_endpoint(
    body: WebhookEndpointCreate,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> WebhookEndpoint:
    url = _validate_url(body.url)
    _validate_events(body.event_types)
    row = await repo.create_endpoint(
        workspace_id=ctx.workspace.id,
        created_by=ctx.user.id if ctx.user else None,
        url=url,
        secret=generate_secret(),
        description=body.description,
        event_types=body.event_types,
    )
    return WebhookEndpoint.model_validate(row)


@router.get(
    "",
    response_model=list[WebhookEndpoint],
    summary="List webhook endpoints",
    description="Returns all webhook endpoints registered for the workspace.",
)
async def list_endpoints(
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> list[WebhookEndpoint]:
    rows = await repo.list_endpoints(ctx.workspace.id)
    return [WebhookEndpoint.model_validate(r) for r in rows]


@router.get(
    "/{endpoint_id}",
    response_model=WebhookEndpoint,
    summary="Get a webhook endpoint",
    description="Returns one webhook endpoint. 404 if not found in this workspace.",
)
async def get_endpoint(
    endpoint_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> WebhookEndpoint:
    row = await repo.get_endpoint(endpoint_id, ctx.workspace.id)
    if row is None:
        raise ApiError(404, "not_found", "Webhook endpoint not found")
    return WebhookEndpoint.model_validate(row)


@router.patch(
    "/{endpoint_id}",
    response_model=WebhookEndpoint,
    summary="Update a webhook endpoint",
    description="Updates a webhook endpoint's URL, description, subscribed event types, and/or enabled state. 404 if not found in this workspace.",
)
async def update_endpoint(
    endpoint_id: str,
    body: WebhookEndpointUpdate,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> WebhookEndpoint:
    url = _validate_url(body.url) if body.url is not None else None
    if body.event_types is not None:
        _validate_events(body.event_types)
    row = await repo.update_endpoint(
        endpoint_id=endpoint_id,
        workspace_id=ctx.workspace.id,
        url=url,
        description=body.description,
        event_types=body.event_types,
        enabled=body.enabled,
    )
    if row is None:
        raise ApiError(404, "not_found", "Webhook endpoint not found")
    return WebhookEndpoint.model_validate(row)


@router.delete(
    "/{endpoint_id}",
    status_code=204,
    summary="Delete a webhook endpoint",
    description="Deletes a webhook endpoint. 404 if not found in this workspace.",
)
async def delete_endpoint(
    endpoint_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> None:
    if not await repo.delete_endpoint(endpoint_id, ctx.workspace.id):
        raise ApiError(404, "not_found", "Webhook endpoint not found")


@router.post(
    "/{endpoint_id}/test",
    response_model=WebhookDelivery,
    status_code=201,
    summary="Send a test webhook delivery",
    description="Enqueues a synthetic `webhook.test` event to this endpoint immediately, useful for verifying signature handling.",
)
async def send_test_event(
    endpoint_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> WebhookDelivery:
    ep = await repo.get_endpoint(endpoint_id, ctx.workspace.id)
    if ep is None:
        raise ApiError(404, "not_found", "Webhook endpoint not found")
    event_id = str(uuid.uuid4())
    payload = {
        "id": event_id,
        "type": "webhook.test",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "data": {"message": "This is a test event from Parlor."},
    }
    row = await repo.enqueue(
        endpoint_id=endpoint_id,
        workspace_id=ctx.workspace.id,
        event_id=event_id,
        event_type="webhook.test",
        payload=payload,
    )
    return WebhookDelivery.model_validate(row)


@router.get(
    "/{endpoint_id}/deliveries",
    response_model=WebhookDeliveryListResponse,
    summary="List deliveries for a webhook endpoint",
    description="Returns the delivery log (attempts, status, response codes) for one webhook endpoint.",
)
async def list_deliveries(
    endpoint_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> WebhookDeliveryListResponse:
    if await repo.get_endpoint(endpoint_id, ctx.workspace.id) is None:
        raise ApiError(404, "not_found", "Webhook endpoint not found")
    rows = await repo.list_deliveries(endpoint_id, ctx.workspace.id)
    items = [WebhookDelivery.model_validate(r) for r in rows]
    return WebhookDeliveryListResponse(items=items, total=len(items))


@router.post(
    "/deliveries/{delivery_id}/redeliver",
    status_code=202,
    summary="Redeliver a webhook delivery",
    description="Puts a delivery back on the queue for an immediate retry, regardless of its current backoff schedule.",
)
async def redeliver(
    delivery_id: str,
    ctx: AuthContext = Depends(get_current_context),
    repo: WebhooksRepo = Depends(_repo),
) -> dict:
    if not await repo.requeue(delivery_id, ctx.workspace.id):
        raise ApiError(404, "not_found", "Delivery not found")
    return {"requeued": True}
