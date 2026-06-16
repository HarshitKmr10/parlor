"""Admin SDK Directory client — list active users in a Workspace domain.

Uses admin-scoped (delegated-admin-impersonated) credentials from a
:class:`GoogleWorkspaceAuth` to call ``directory.users().list()``, handling
pagination, and returns the active users' email addresses. Read-only
(``admin.directory.user.readonly``).

The google-api-python-client call is synchronous; callers in async contexts
should wrap :meth:`list_active_user_emails` in ``asyncio.to_thread``.
"""

from __future__ import annotations

from typing import List, Optional, Sequence

from ...observability import get_logger
from .auth import DIRECTORY_READONLY_SCOPE, GoogleWorkspaceAuth

logger = get_logger(__name__)

_PAGE_SIZE = 200  # Directory API max per page is 500; 200 keeps responses lean.


class DirectoryClient:
    """Lists active org users via the Admin SDK Directory API."""

    def __init__(
        self,
        auth: GoogleWorkspaceAuth,
        *,
        scopes: Sequence[str] = (DIRECTORY_READONLY_SCOPE,),
    ) -> None:
        self._auth = auth
        self._scopes = tuple(scopes)

    def _service(self):
        # Lazy import: keeps the app importable with no Google libs exercised
        # until an org is actually configured.
        from googleapiclient.discovery import build  # noqa: PLC0415

        creds = self._auth.get_admin_credentials(self._scopes)
        return build("admin", "directory_v1", credentials=creds, cache_discovery=False)

    def list_active_user_emails(
        self,
        *,
        domain: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> List[str]:
        """Return active (non-suspended) user emails in the domain/customer.

        Pass either ``domain`` or ``customer_id``; if neither is given, falls
        back to ``customer="my_customer"`` (the authorizing admin's own org).
        Suspended users are filtered out — we never want to spin up a bot for a
        disabled account's calendar.
        """
        service = self._service()
        users_api = service.users()

        list_kwargs = {
            "maxResults": _PAGE_SIZE,
            "orderBy": "email",
            "projection": "basic",
        }
        if domain:
            list_kwargs["domain"] = domain
        elif customer_id:
            list_kwargs["customer"] = customer_id
        else:
            list_kwargs["customer"] = "my_customer"

        emails: List[str] = []
        page_token: Optional[str] = None
        while True:
            request = users_api.list(pageToken=page_token, **list_kwargs)
            response = request.execute() or {}
            for user in response.get("users") or []:
                if user.get("suspended"):
                    continue
                email = user.get("primaryEmail")
                if email:
                    emails.append(email)
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logger.info("google_workspace.directory.listed", user_count=len(emails))
        return emails
