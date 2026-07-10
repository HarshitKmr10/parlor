"""/api/v1/integrations — read/set per-workspace outbound recap config."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends

from ...integrations import KNOWN_KINDS, PROVIDERS, IntegrationsRepo
from ...integrations.crm_providers import validate_salesforce_instance_url
from ...integrations.secret_fields import redact_config_secrets
from ...webhooks.safety import InvalidWebhookUrl
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_db
from .errors import ApiError
from .rbac import require_role
from .schemas import Integration, IntegrationUpdate

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def _implemented(kind: str) -> bool:
    """True if ``kind`` has a real, registered provider.

    Every kind currently in :data:`PROVIDERS` is fully implemented, so this
    is just membership. Kept as a named helper (rather than inlining
    ``kind in PROVIDERS``) so a future placeholder/not-yet-implemented
    provider has a single place to report itself as such.
    """
    return kind in PROVIDERS


async def _repo(db: DatabaseConnection = Depends(get_db)) -> IntegrationsRepo:
    return IntegrationsRepo(db)


@router.get(
    "",
    response_model=List[Integration],
    summary="List outbound integrations",
    description=(
        "Returns one entry per known integration kind (slack, email, "
        "notion, hubspot, salesforce), merged with any stored config. Kinds "
        "with no stored row come back disabled with empty config. Admin-"
        "gated because stored config carries live credentials — CRM/Notion "
        "credential fields (token/apiKey/accessToken/refreshToken) are "
        "never returned in cleartext; they come back as `true` presence "
        "markers, same treatment as the Google Workspace service-account key."
    ),
)
async def list_integrations(
    ctx: AuthContext = Depends(require_role("admin")),
    repo: IntegrationsRepo = Depends(_repo),
) -> List[Integration]:
    """Return one entry per known integration kind, merged with stored config.

    Kinds with no stored row are returned disabled with empty config so the
    dashboard always sees the full set of available integrations. Credential
    sub-fields are redacted to a boolean presence marker (see
    ``secret_fields.redact_config_secrets``) — never returned in cleartext.

    Admin-gated: stored config carries live credentials (Slack webhook URLs,
    CRM tokens), so read access is restricted the same as write access.
    """
    stored = {r["kind"]: r for r in await repo.list_for_workspace(ctx.workspace.id)}
    out: List[Integration] = []
    for kind in KNOWN_KINDS:
        row = stored.get(kind)
        out.append(
            Integration(
                kind=kind,  # type: ignore[arg-type]
                enabled=bool(row["enabled"]) if row else False,
                config=redact_config_secrets(row["config"]) if row else {},
                implemented=_implemented(kind),
            )
        )
    return out


@router.put(
    "",
    response_model=Integration,
    summary="Configure an outbound integration",
    description=(
        "Upserts config and enabled state for one integration kind (one row "
        "per workspace + kind). When enabled, this integration is called on "
        "every `meeting.completed` event to deliver a recap. Requires the "
        "admin role."
    ),
)
async def upsert_integration(
    body: IntegrationUpdate,
    ctx: AuthContext = Depends(require_role("admin")),
    repo: IntegrationsRepo = Depends(_repo),
) -> Integration:
    """Upsert config for one integration kind (one row per workspace+kind)."""
    if body.kind not in KNOWN_KINDS:
        raise ApiError(
            400, "unknown_integration", f"Unknown integration kind: {body.kind}"
        )
    if body.kind == "salesforce":
        instance_url = (body.config or {}).get("instanceUrl") or (
            body.config or {}
        ).get("instance_url")
        if instance_url:
            try:
                validate_salesforce_instance_url(str(instance_url))
            except InvalidWebhookUrl as exc:
                raise ApiError(400, "invalid_instance_url", str(exc)) from exc
    row = await repo.upsert(
        workspace_id=ctx.workspace.id,
        kind=body.kind,
        config=body.config or {},
        enabled=bool(body.enabled),
    )
    return Integration(
        kind=row["kind"],
        enabled=bool(row["enabled"]),
        config=redact_config_secrets(row["config"]),
        implemented=_implemented(row["kind"]),
    )
