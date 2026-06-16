"""Credential-minting abstraction for org-wide Google Workspace access.

Goal: a Workspace admin authorizes ONCE, and we mint per-user credentials to
read every org user's calendar (and admin-scoped credentials for the Directory
API). The abstraction hides *how* those credentials are obtained so we can swap
the mechanism without touching the directory/sync callers:

* :class:`DomainWideDelegationAuth` — a service-account JSON whose client is
  granted domain-wide delegation in the Workspace admin console. We impersonate
  any domain user via ``Credentials.with_subject(user_email)``. Admin calls
  impersonate the configured delegated-admin email (DWD requires a real
  subject; the Directory API rejects a bare service account). [IMPLEMENTED]

* :class:`MarketplaceAppAuth` — a Workspace Marketplace app. The method shape is
  identical so it can be dropped in later; the impl is a stub today. [STUB]

The factory :func:`get_workspace_auth` picks an impl from an org config's
``auth_mode``, defaulting to ``"dwd"``.

Seam for pass 2 (Meet ad-hoc events + Pub/Sub): the ad-hoc event reader and the
Pub/Sub push handler both need user/admin credentials for the same org. They
will call ``get_workspace_auth(org).get_user_credentials(...)`` /
``get_admin_credentials(...)`` exactly like the directory + calendar-sync
callers do here — no new auth plumbing required.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, List, Optional, Sequence

# ── Scopes ────────────────────────────────────────────────────────────────
# Read-only by design: we only need to discover users and read their calendars.
DIRECTORY_READONLY_SCOPE = (
    "https://www.googleapis.com/auth/admin.directory.user.readonly"
)
CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"

#: Union of every scope the org-wide flow may request. The service-account
#: client must be authorized for exactly these in the admin console.
DEFAULT_WORKSPACE_SCOPES: tuple[str, ...] = (
    DIRECTORY_READONLY_SCOPE,
    CALENDAR_READONLY_SCOPE,
)

AUTH_MODE_DWD = "dwd"
AUTH_MODE_MARKETPLACE = "marketplace"


class WorkspaceAuthError(Exception):
    """Raised when credentials cannot be minted (bad SA JSON, missing config)."""


@dataclass(frozen=True)
class OrgAuthConfig:
    """The decrypted, in-memory auth config for one Workspace org.

    This is the seam the factory consumes. The repo decrypts the
    service-account JSON before constructing it; it is never persisted as-is
    and never returned by the API.
    """

    auth_mode: str = AUTH_MODE_DWD
    service_account_info: Optional[dict] = None  # parsed SA JSON (DWD only)
    delegated_admin_email: Optional[str] = None
    domain: Optional[str] = None
    customer_id: Optional[str] = None
    marketplace_client_id: Optional[str] = None
    marketplace_project_number: Optional[str] = None

    @staticmethod
    def from_service_account_json(
        sa_json: Optional[str],
        *,
        auth_mode: str = AUTH_MODE_DWD,
        delegated_admin_email: Optional[str] = None,
        domain: Optional[str] = None,
        customer_id: Optional[str] = None,
        marketplace_client_id: Optional[str] = None,
        marketplace_project_number: Optional[str] = None,
    ) -> "OrgAuthConfig":
        info: Optional[dict] = None
        if sa_json:
            try:
                info = json.loads(sa_json)
            except (ValueError, TypeError) as exc:
                raise WorkspaceAuthError(
                    f"service_account_json is not valid JSON: {exc}"
                ) from exc
        return OrgAuthConfig(
            auth_mode=auth_mode or AUTH_MODE_DWD,
            service_account_info=info,
            delegated_admin_email=delegated_admin_email,
            domain=domain,
            customer_id=customer_id,
            marketplace_client_id=marketplace_client_id,
            marketplace_project_number=marketplace_project_number,
        )


class GoogleWorkspaceAuth(ABC):
    """Mints Google credentials for org-wide access.

    Implementations return objects compatible with
    ``googleapiclient.discovery.build(..., credentials=creds)``.
    """

    @abstractmethod
    def get_user_credentials(self, user_email: str, scopes: Sequence[str]) -> Any:
        """Credentials acting AS ``user_email`` (per-user calendar reads)."""

    @abstractmethod
    def get_admin_credentials(self, scopes: Sequence[str]) -> Any:
        """Credentials acting as the delegated admin (Directory API)."""


class DomainWideDelegationAuth(GoogleWorkspaceAuth):
    """Service-account domain-wide delegation.

    Impersonates any domain user with ``with_subject``. The same service
    account, impersonating the configured delegated admin, drives admin-scoped
    calls (Directory).
    """

    def __init__(
        self,
        *,
        service_account_info: dict,
        delegated_admin_email: Optional[str],
    ) -> None:
        if not service_account_info:
            raise WorkspaceAuthError(
                "DomainWideDelegationAuth requires a service-account JSON"
            )
        self._sa_info = service_account_info
        self._admin_email = delegated_admin_email

    def _base_credentials(self, scopes: Sequence[str]):
        # Imported lazily so the app boots with NO Google creds / libs touched
        # until an org is actually configured.
        from google.oauth2 import service_account  # noqa: PLC0415

        try:
            return service_account.Credentials.from_service_account_info(
                self._sa_info, scopes=list(scopes)
            )
        except (ValueError, KeyError) as exc:
            raise WorkspaceAuthError(f"Invalid service-account JSON: {exc}") from exc

    def get_user_credentials(self, user_email: str, scopes: Sequence[str]) -> Any:
        if not user_email:
            raise WorkspaceAuthError("get_user_credentials requires a user_email")
        return self._base_credentials(scopes).with_subject(user_email)

    def get_admin_credentials(self, scopes: Sequence[str]) -> Any:
        if not self._admin_email:
            raise WorkspaceAuthError(
                "Domain-wide delegation needs a delegated_admin_email to "
                "impersonate for admin-scoped (Directory) calls"
            )
        return self._base_credentials(scopes).with_subject(self._admin_email)


class MarketplaceAppAuth(GoogleWorkspaceAuth):
    """Workspace Marketplace app auth — interface reserved, impl deferred.

    The method shape matches :class:`DomainWideDelegationAuth` so the directory
    + calendar-sync callers (and pass-2 Meet/Pub-Sub callers) need no changes
    when this is implemented. A Marketplace install grants the app domain-wide
    access without a service-account key; credentials would be obtained from the
    app's OAuth client + the admin's install grant.
    """

    def __init__(
        self,
        *,
        client_id: Optional[str] = None,
        project_number: Optional[str] = None,
        delegated_admin_email: Optional[str] = None,
    ) -> None:
        self._client_id = client_id
        self._project_number = project_number
        self._admin_email = delegated_admin_email

    def get_user_credentials(self, user_email: str, scopes: Sequence[str]) -> Any:
        raise NotImplementedError("marketplace auth not yet configured")

    def get_admin_credentials(self, scopes: Sequence[str]) -> Any:
        raise NotImplementedError("marketplace auth not yet configured")


def get_workspace_auth(org_config: OrgAuthConfig) -> GoogleWorkspaceAuth:
    """Pick a :class:`GoogleWorkspaceAuth` impl by ``org_config.auth_mode``.

    Defaults to domain-wide delegation. Raises :class:`WorkspaceAuthError` for
    an unknown mode so misconfiguration fails loudly rather than silently
    no-op'ing.
    """
    mode = (org_config.auth_mode or AUTH_MODE_DWD).lower()
    if mode == AUTH_MODE_DWD:
        return DomainWideDelegationAuth(
            service_account_info=org_config.service_account_info or {},
            delegated_admin_email=org_config.delegated_admin_email,
        )
    if mode == AUTH_MODE_MARKETPLACE:
        return MarketplaceAppAuth(
            client_id=org_config.marketplace_client_id,
            project_number=org_config.marketplace_project_number,
            delegated_admin_email=org_config.delegated_admin_email,
        )
    raise WorkspaceAuthError(f"Unknown Google Workspace auth_mode: {mode!r}")
