"""Best-effort audit writer used by sensitive routes."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from .repo import AuditRepo

logger = logging.getLogger("audit")


async def record_audit(
    db,
    *,
    workspace_id: str,
    actor_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Record an audit event. Never raises — failures are logged and swallowed."""
    try:
        await AuditRepo(db).create(
            workspace_id=workspace_id,
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("audit write failed (%s): %s", action, exc)
