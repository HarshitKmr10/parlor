"""/api/v1/google-workspace — configure org-wide Google Workspace capture.

A Workspace admin authorizes ONCE here (service-account JSON for domain-wide
delegation today; Marketplace fields reserved) and the backend reads every org
user's calendar to auto-join scheduled Meet meetings org-wide.

Endpoints (workspace-scoped, auth required):

* ``POST   /google-workspace``        configure / enable (upload SA JSON + admin)
* ``GET    /google-workspace``        current config (SA JSON NEVER returned —
                                      only a fingerprint + flags)
* ``DELETE /google-workspace``        remove config
* ``GET    /google-workspace/users``  preview discovered org users (proves
                                      Directory + DWD work)

Degradation: everything boots with NO Google creds. With no org configured the
endpoints return a clear 400 ``google_workspace_not_configured``.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends

from ...integrations.google_workspace import (
    DirectoryClient,
    GoogleWorkspaceOrgRepo,
    get_workspace_auth,
)
from ...integrations.google_workspace.auth import (
    AUTH_MODE_DWD,
    DIRECTORY_READONLY_SCOPE,
    WorkspaceAuthError,
)
from ..database.connection import DatabaseConnection
from .deps import get_current_workspace, get_db
from .errors import ApiError
from .schemas import (
    GoogleWorkspaceConfig,
    GoogleWorkspaceConfigRequest,
    GoogleWorkspaceUsersResponse,
    Workspace,
)

router = APIRouter(prefix="/api/v1/google-workspace", tags=["google-workspace"])


async def _repo(db: DatabaseConnection = Depends(get_db)) -> GoogleWorkspaceOrgRepo:
    return GoogleWorkspaceOrgRepo(db)


def _to_config(row: dict) -> GoogleWorkspaceConfig:
    return GoogleWorkspaceConfig.model_validate(row)


@router.post("", response_model=GoogleWorkspaceConfig)
async def configure(
    body: GoogleWorkspaceConfigRequest,
    workspace: Workspace = Depends(get_current_workspace),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceConfig:
    existing = await repo.get_public(workspace.id)

    if body.auth_mode == AUTH_MODE_DWD:
        # First configure under DWD must supply a service-account JSON.
        if not body.service_account_json and not (
            existing and existing.get("has_service_account")
        ):
            raise ApiError(
                400,
                "service_account_required",
                "Domain-wide delegation requires a serviceAccountJson on first "
                "configure.",
            )
        if not body.delegated_admin_email:
            raise ApiError(
                400,
                "delegated_admin_required",
                "Domain-wide delegation requires a delegatedAdminEmail to "
                "impersonate for Directory + calendar reads.",
            )
        # Validate the SA JSON parses (don't store garbage that fails at sync).
        if body.service_account_json:
            try:
                json.loads(body.service_account_json)
            except (ValueError, TypeError) as exc:
                raise ApiError(
                    400,
                    "invalid_service_account_json",
                    f"serviceAccountJson is not valid JSON: {exc}",
                )

    row = await repo.upsert(
        workspace_id=workspace.id,
        auth_mode=body.auth_mode,
        service_account_json=body.service_account_json,
        delegated_admin_email=(
            str(body.delegated_admin_email) if body.delegated_admin_email else None
        ),
        domain=body.domain,
        customer_id=body.customer_id,
        marketplace_client_id=body.marketplace_client_id,
        marketplace_project_number=body.marketplace_project_number,
        enabled=body.enabled,
    )
    return _to_config(row)


@router.get("", response_model=GoogleWorkspaceConfig)
async def get_config(
    workspace: Workspace = Depends(get_current_workspace),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceConfig:
    row = await repo.get_public(workspace.id)
    if row is None:
        raise ApiError(
            400,
            "google_workspace_not_configured",
            "Org-wide Google Workspace capture is not configured for this "
            "workspace.",
        )
    return _to_config(row)


@router.delete("")
async def delete_config(
    workspace: Workspace = Depends(get_current_workspace),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> dict:
    deleted = await repo.delete(workspace.id)
    if not deleted:
        raise ApiError(
            400,
            "google_workspace_not_configured",
            "Nothing to delete — org-wide capture is not configured.",
        )
    return {"deleted": True}


@router.get("/users", response_model=GoogleWorkspaceUsersResponse)
async def list_users(
    workspace: Workspace = Depends(get_current_workspace),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceUsersResponse:
    """Preview discovered org users — proves Directory + DWD work end to end."""
    auth_config = await repo.get_auth_config(workspace.id)
    if auth_config is None:
        raise ApiError(
            400,
            "google_workspace_not_configured",
            "Org-wide Google Workspace capture is not configured for this "
            "workspace.",
        )
    try:
        auth = get_workspace_auth(auth_config)
        client = DirectoryClient(auth, scopes=(DIRECTORY_READONLY_SCOPE,))
        emails = await asyncio.to_thread(
            client.list_active_user_emails,
            domain=auth_config.domain,
            customer_id=auth_config.customer_id,
        )
    except NotImplementedError as exc:
        raise ApiError(501, "auth_mode_not_implemented", str(exc))
    except WorkspaceAuthError as exc:
        raise ApiError(400, "google_workspace_auth_error", str(exc))
    except Exception as exc:  # noqa: BLE001
        raise ApiError(
            502,
            "google_workspace_directory_error",
            f"Failed to list org users: {exc}",
        )
    return GoogleWorkspaceUsersResponse(users=emails, total=len(emails))
