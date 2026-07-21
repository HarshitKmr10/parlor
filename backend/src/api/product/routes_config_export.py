"""Configuration export API — download the workspace Parlor config as JSON.

  GET /api/v1/config-export

Bundles the read-only workspace configuration collections (tags, saved views,
saved prompts, redaction rules, capture exclusions, auto-tag rules, share
settings, capture prefs) into one JSON dict for backup and portability between
self-hosted instances. Admin-gated: it is a full-config dump, so it matches the
admin gate used by the other workspace-wide export (GDPR data export).
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends

from ...config_export import ConfigExportService
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_db
from .rbac import require_role

router = APIRouter(prefix="/api/v1/config-export", tags=["config-export"])


async def _service(db: DatabaseConnection = Depends(get_db)) -> ConfigExportService:
    return ConfigExportService(db)


@router.get(
    "",
    summary="Export workspace configuration",
    description=(
        "Returns the workspace's Parlor configuration as one JSON object: "
        "tags, saved views, saved prompts, redaction rules, capture "
        "exclusions, auto-tag rules, share settings, and capture prefs. "
        "Read-only; intended for backup and moving config between self-hosted "
        "instances. Requires the admin role."
    ),
)
async def export_config(
    ctx: AuthContext = Depends(require_role("admin")),
    service: ConfigExportService = Depends(_service),
) -> Dict[str, Any]:
    return await service.build(ctx.workspace.id)
