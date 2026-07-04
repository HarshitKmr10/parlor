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
from ...integrations.google_workspace.policy import OrgMeetingPolicyRepo
from ...services.meet_events_service import (
    MeetEventsService,
    PubSubNotConfiguredError,
    WorkspaceNotConfiguredError,
)
from ..database.connection import DatabaseConnection
from .deps import AuthContext, get_current_workspace, get_db
from .errors import ApiError
from .rbac import require_role
from .schemas import (
    EventSubscribeResponse,
    EventSubscription,
    EventSubscriptionsResponse,
    GoogleWorkspaceConfig,
    GoogleWorkspaceConfigRequest,
    GoogleWorkspaceUsersResponse,
    OrgMeetingPolicyModel,
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
    ctx: AuthContext = Depends(require_role("admin")),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceConfig:
    existing = await repo.get_public(ctx.workspace.id)

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
        workspace_id=ctx.workspace.id,
        auth_mode=body.auth_mode,
        service_account_json=body.service_account_json,
        delegated_admin_email=(
            str(body.delegated_admin_email) if body.delegated_admin_email else None
        ),
        domain=body.domain,
        customer_id=body.customer_id,
        marketplace_client_id=body.marketplace_client_id,
        marketplace_project_number=body.marketplace_project_number,
        notetaker_email=(
            str(body.notetaker_email) if body.notetaker_email else None
        ),
        enabled=body.enabled,
    )
    return _to_config(row)


@router.get("", response_model=GoogleWorkspaceConfig)
async def get_config(
    ctx: AuthContext = Depends(require_role("admin")),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceConfig:
    row = await repo.get_public(ctx.workspace.id)
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
    ctx: AuthContext = Depends(require_role("admin")),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> dict:
    deleted = await repo.delete(ctx.workspace.id)
    if not deleted:
        raise ApiError(
            400,
            "google_workspace_not_configured",
            "Nothing to delete — org-wide capture is not configured.",
        )
    return {"deleted": True}


@router.get("/users", response_model=GoogleWorkspaceUsersResponse)
async def list_users(
    ctx: AuthContext = Depends(require_role("admin")),
    repo: GoogleWorkspaceOrgRepo = Depends(_repo),
) -> GoogleWorkspaceUsersResponse:
    """Preview discovered org users — proves Directory + DWD work end to end."""
    auth_config = await repo.get_auth_config(ctx.workspace.id)
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


# ── Pass 2: Workspace Events subscription lifecycle ──────────────────────────


@router.post("/events/subscribe", response_model=EventSubscribeResponse)
async def subscribe_events(
    ctx: AuthContext = Depends(require_role("admin")),
) -> EventSubscribeResponse:
    """Provision Meet conference-lifecycle subscriptions across the org.

    Fans a Workspace Events subscription out to every active org user so an
    instant Meet (one that never touches a calendar) fires a Pub/Sub push to our
    webhook. Requires both an enabled org config AND a Pub/Sub topic.
    """
    try:
        summary = await MeetEventsService().provision_workspace(ctx.workspace.id)
    except PubSubNotConfiguredError as exc:
        raise ApiError(400, "pubsub_not_configured", str(exc))
    except WorkspaceNotConfiguredError as exc:
        raise ApiError(400, "google_workspace_not_configured", str(exc))
    except NotImplementedError as exc:
        raise ApiError(501, "auth_mode_not_implemented", str(exc))
    except WorkspaceAuthError as exc:
        raise ApiError(400, "google_workspace_auth_error", str(exc))
    except Exception as exc:  # noqa: BLE001
        raise ApiError(502, "events_subscribe_error", f"Failed to subscribe: {exc}")
    return EventSubscribeResponse.model_validate(summary)


@router.get("/events/subscriptions", response_model=EventSubscriptionsResponse)
async def list_event_subscriptions(
    ctx: AuthContext = Depends(require_role("admin")),
) -> EventSubscriptionsResponse:
    """List the workspace's Workspace Events subscriptions + their states."""
    rows = await MeetEventsService().list_subscriptions(ctx.workspace.id)
    subs = [EventSubscription.model_validate(r) for r in rows]
    return EventSubscriptionsResponse(subscriptions=subs, total=len(subs))


@router.delete("/events/subscriptions")
async def delete_event_subscriptions(
    ctx: AuthContext = Depends(require_role("admin")),
) -> dict:
    """Tear down all Workspace Events subscriptions for the workspace."""
    summary = await MeetEventsService().teardown_workspace(ctx.workspace.id)
    return summary


# ── Pass 2: org meeting policy ───────────────────────────────────────────────


@router.get("/policy", response_model=OrgMeetingPolicyModel)
async def get_policy(
    workspace: Workspace = Depends(get_current_workspace),
    db: DatabaseConnection = Depends(get_db),
) -> OrgMeetingPolicyModel:
    """Current auto-join policy (permissive default when none is configured)."""
    policy = await OrgMeetingPolicyRepo(db).get(workspace.id)
    return OrgMeetingPolicyModel.model_validate(
        {
            "autoJoinEnabled": policy.auto_join_enabled,
            "mode": policy.mode,
            "allow": policy.allow or {},
            "deny": policy.deny or {},
            "optOutEmails": policy.opt_out_emails or [],
            "recordingDisclosureText": policy.recording_disclosure_text,
        }
    )


@router.put("/policy", response_model=OrgMeetingPolicyModel)
async def put_policy(
    body: OrgMeetingPolicyModel,
    workspace: Workspace = Depends(get_current_workspace),
    db: DatabaseConnection = Depends(get_db),
) -> OrgMeetingPolicyModel:
    """Upsert the workspace's auto-join policy."""
    try:
        policy = await OrgMeetingPolicyRepo(db).upsert(
            workspace_id=workspace.id,
            auto_join_enabled=body.auto_join_enabled,
            mode=body.mode,
            allow=body.allow.model_dump(),
            deny=body.deny.model_dump(),
            opt_out_emails=body.opt_out_emails,
            recording_disclosure_text=body.recording_disclosure_text,
        )
    except ValueError as exc:
        raise ApiError(400, "invalid_policy", str(exc))
    return OrgMeetingPolicyModel.model_validate(
        {
            "autoJoinEnabled": policy.auto_join_enabled,
            "mode": policy.mode,
            "allow": policy.allow or {},
            "deny": policy.deny or {},
            "optOutEmails": policy.opt_out_emails or [],
            "recordingDisclosureText": policy.recording_disclosure_text,
        }
    )
