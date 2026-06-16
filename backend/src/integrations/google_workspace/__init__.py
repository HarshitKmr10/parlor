"""Org-wide Google Workspace meeting capture.

A Workspace admin authorizes ONCE (domain-wide delegation today; a Marketplace
app later) and the backend reads every org user's calendar to auto-join
scheduled Meet meetings org-wide — instead of every user connecting their own
calendar.

Public surface:

* :class:`GoogleWorkspaceAuth` — credential-minting abstraction. Two impls:
  :class:`DomainWideDelegationAuth` (service account, implemented) and
  :class:`MarketplaceAppAuth` (interface reserved, stub impl).
* :func:`get_workspace_auth` — factory that picks an impl by ``auth_mode``.
* :class:`DirectoryClient` — lists active org users via the Admin SDK.
* :class:`GoogleWorkspaceOrgRepo` — persistence (SA JSON encrypted at rest).
"""

from __future__ import annotations

from .auth import (
    DomainWideDelegationAuth,
    GoogleWorkspaceAuth,
    MarketplaceAppAuth,
    OrgAuthConfig,
    get_workspace_auth,
)
from .directory import DirectoryClient
from .events import (
    DEFAULT_MEET_EVENT_TYPES,
    EVENT_CONFERENCE_STARTED,
    EVENT_PARTICIPANT_JOINED,
    MeetSpaceResolver,
    SubscriptionResult,
    WorkspaceEventsClient,
    WorkspaceEventSubscriptionRepo,
)
from .policy import (
    OrgMeetingPolicy,
    OrgMeetingPolicyRepo,
    PolicyDecision,
)
from .repo import GoogleWorkspaceOrgRepo

__all__ = [
    "GoogleWorkspaceAuth",
    "DomainWideDelegationAuth",
    "MarketplaceAppAuth",
    "OrgAuthConfig",
    "get_workspace_auth",
    "DirectoryClient",
    "GoogleWorkspaceOrgRepo",
    # Pass 2: ad-hoc Meet events
    "WorkspaceEventsClient",
    "WorkspaceEventSubscriptionRepo",
    "MeetSpaceResolver",
    "SubscriptionResult",
    "DEFAULT_MEET_EVENT_TYPES",
    "EVENT_CONFERENCE_STARTED",
    "EVENT_PARTICIPANT_JOINED",
    # Pass 2: org meeting policy
    "OrgMeetingPolicy",
    "OrgMeetingPolicyRepo",
    "PolicyDecision",
]
