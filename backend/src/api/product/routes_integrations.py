"""/api/v1/integrations — read/set per-workspace outbound recap config."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends

from ...integrations import KNOWN_KINDS, PROVIDERS, IntegrationsRepo
from ...integrations.stub_providers import _NotImplementedProvider
from ..database.connection import DatabaseConnection
from .deps import get_db, get_current_workspace
from .errors import ApiError
from .schemas import Integration, IntegrationUpdate, Workspace

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])


def _implemented(kind: str) -> bool:
    provider = PROVIDERS.get(kind)
    return provider is not None and not isinstance(provider, _NotImplementedProvider)


async def _repo(db: DatabaseConnection = Depends(get_db)) -> IntegrationsRepo:
    return IntegrationsRepo(db)


@router.get("", response_model=List[Integration])
async def list_integrations(
    workspace: Workspace = Depends(get_current_workspace),
    repo: IntegrationsRepo = Depends(_repo),
) -> List[Integration]:
    """Return one entry per known integration kind, merged with stored config.

    Kinds with no stored row are returned disabled with empty config so the
    dashboard always sees the full set of available integrations.
    """
    stored = {r["kind"]: r for r in await repo.list_for_workspace(workspace.id)}
    out: List[Integration] = []
    for kind in KNOWN_KINDS:
        row = stored.get(kind)
        out.append(
            Integration(
                kind=kind,  # type: ignore[arg-type]
                enabled=bool(row["enabled"]) if row else False,
                config=row["config"] if row else {},
                implemented=_implemented(kind),
            )
        )
    return out


@router.put("", response_model=Integration)
async def upsert_integration(
    body: IntegrationUpdate,
    workspace: Workspace = Depends(get_current_workspace),
    repo: IntegrationsRepo = Depends(_repo),
) -> Integration:
    """Upsert config for one integration kind (one row per workspace+kind)."""
    if body.kind not in KNOWN_KINDS:
        raise ApiError(
            400, "unknown_integration", f"Unknown integration kind: {body.kind}"
        )
    row = await repo.upsert(
        workspace_id=workspace.id,
        kind=body.kind,
        config=body.config or {},
        enabled=bool(body.enabled),
    )
    return Integration(
        kind=row["kind"],
        enabled=bool(row["enabled"]),
        config=row["config"],
        implemented=_implemented(row["kind"]),
    )
