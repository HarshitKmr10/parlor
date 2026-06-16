"""Org meeting auto-join policy — consulted before EVERY bot dispatch.

Both the calendar sync (pass 1) and the ad-hoc Meet events path (pass 2) call
:meth:`OrgMeetingPolicyRepo.evaluate` before dispatching a bot. The policy
answers a single question: *should we join this meeting?* — taking into account

* whether auto-join is enabled at all,
* the mode (``all`` / ``allowlist`` / ``denylist``),
* per-organizer / per-domain / per-OU allow & deny rules,
* explicit organizer opt-outs.

Design notes:

* The policy is per-workspace, one row in ``org_meeting_policy`` (PK
  workspace_id), upserted by the policy route. A workspace with NO row gets a
  permissive default (auto-join on, mode ``all``) so the existing calendar-sync
  behaviour is unchanged until an admin tightens it — i.e. pass 1 keeps working.
* Matching is case-insensitive on emails and domains. A bare ``domains`` rule
  matches the organizer's email domain.
* The decision is a small immutable dataclass so callers log a clear reason.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ...db.python.schema import qualified_name

MODE_ALL = "all"
MODE_ALLOWLIST = "allowlist"
MODE_DENYLIST = "denylist"
_VALID_MODES = (MODE_ALL, MODE_ALLOWLIST, MODE_DENYLIST)


def _table(db, name: str) -> str:
    return qualified_name(name) if getattr(db, "_driver", None) == "pg" else name


def _as_list(value: Any) -> List[str]:
    """Coerce a JSONB column (str or already-parsed list) into a lower list."""
    if value is None:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return []
    if isinstance(value, list):
        return [str(v).strip().lower() for v in value if str(v).strip()]
    return []


def _as_dict(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    return value if isinstance(value, dict) else {}


def _domain_of(email: Optional[str]) -> Optional[str]:
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[1].strip().lower()


@dataclass(frozen=True)
class PolicyDecision:
    """Result of evaluating policy for one prospective join."""

    allowed: bool
    reason: str

    def __bool__(self) -> bool:  # lets callers do `if decision:`
        return self.allowed


@dataclass(frozen=True)
class OrgMeetingPolicy:
    """In-memory view of one workspace's policy row."""

    workspace_id: str
    auto_join_enabled: bool = True
    mode: str = MODE_ALL
    allow: Dict[str, Any] = None  # type: ignore[assignment]
    deny: Dict[str, Any] = None  # type: ignore[assignment]
    opt_out_emails: List[str] = None  # type: ignore[assignment]
    recording_disclosure_text: Optional[str] = None

    @staticmethod
    def permissive(workspace_id: str) -> "OrgMeetingPolicy":
        """Default when no row exists: join everything (pass-1 behaviour)."""
        return OrgMeetingPolicy(
            workspace_id=workspace_id,
            auto_join_enabled=True,
            mode=MODE_ALL,
            allow={},
            deny={},
            opt_out_emails=[],
        )

    def _matches(self, rules: Dict[str, Any], *, email: Optional[str],
                 organizer_ou: Optional[str]) -> bool:
        emails = _as_list(rules.get("emails"))
        domains = _as_list(rules.get("domains"))
        ous = _as_list(rules.get("ous"))
        e = (email or "").strip().lower()
        if e and e in emails:
            return True
        dom = _domain_of(email)
        if dom and dom in domains:
            return True
        if organizer_ou and organizer_ou.strip().lower() in ous:
            return True
        return False

    def evaluate(
        self,
        *,
        organizer_email: Optional[str] = None,
        organizer_ou: Optional[str] = None,
    ) -> PolicyDecision:
        """Decide whether to auto-join. Pure; no I/O."""
        if not self.auto_join_enabled:
            return PolicyDecision(False, "auto_join_disabled")

        opt_outs = _as_list(self.opt_out_emails)
        e = (organizer_email or "").strip().lower()
        if e and e in opt_outs:
            return PolicyDecision(False, "organizer_opted_out")

        deny = _as_dict(self.deny)
        if deny and self._matches(deny, email=organizer_email, organizer_ou=organizer_ou):
            return PolicyDecision(False, "denylisted")

        mode = (self.mode or MODE_ALL).lower()
        if mode == MODE_ALLOWLIST:
            allow = _as_dict(self.allow)
            if not self._matches(allow, email=organizer_email, organizer_ou=organizer_ou):
                return PolicyDecision(False, "not_in_allowlist")
            return PolicyDecision(True, "allowlisted")

        # MODE_ALL or MODE_DENYLIST (and not denied above).
        return PolicyDecision(True, "policy_allows")


class OrgMeetingPolicyRepo:
    """Persistence + evaluation entrypoint for ``org_meeting_policy``."""

    def __init__(self, db) -> None:
        self._db = db

    async def get(self, workspace_id: str) -> OrgMeetingPolicy:
        """Load the policy, or a permissive default when none is configured."""
        table = _table(self._db, "org_meeting_policy")
        rows = await self._db.store.query_raw(
            f"SELECT workspace_id, auto_join_enabled, mode, allow, deny, "
            f"opt_out_emails, recording_disclosure_text "
            f"FROM {table} WHERE workspace_id = $1::uuid",
            workspace_id,
        )
        if not rows:
            return OrgMeetingPolicy.permissive(workspace_id)
        row = dict(rows[0])
        return OrgMeetingPolicy(
            workspace_id=str(row.get("workspace_id")),
            auto_join_enabled=bool(row.get("auto_join_enabled", True)),
            mode=row.get("mode") or MODE_ALL,
            allow=_as_dict(row.get("allow")),
            deny=_as_dict(row.get("deny")),
            opt_out_emails=_as_list(row.get("opt_out_emails")),
            recording_disclosure_text=row.get("recording_disclosure_text"),
        )

    async def evaluate(
        self,
        workspace_id: Optional[str],
        *,
        organizer_email: Optional[str] = None,
        organizer_ou: Optional[str] = None,
    ) -> PolicyDecision:
        """Convenience: load + evaluate in one call.

        A ``None`` workspace_id (e.g. an un-attributed dispatch) is treated as
        permissive — policy can only gate workspace-scoped joins.
        """
        if not workspace_id:
            return PolicyDecision(True, "no_workspace_scope")
        policy = await self.get(workspace_id)
        return policy.evaluate(
            organizer_email=organizer_email, organizer_ou=organizer_ou
        )

    async def upsert(
        self,
        *,
        workspace_id: str,
        auto_join_enabled: bool,
        mode: str,
        allow: Dict[str, Any],
        deny: Dict[str, Any],
        opt_out_emails: List[str],
        recording_disclosure_text: Optional[str],
    ) -> OrgMeetingPolicy:
        if (mode or MODE_ALL).lower() not in _VALID_MODES:
            raise ValueError(f"invalid policy mode: {mode!r}")
        table = _table(self._db, "org_meeting_policy")
        await self._db.store.query_raw(
            f"""
            INSERT INTO {table}
              (workspace_id, auto_join_enabled, mode, allow, deny,
               opt_out_emails, recording_disclosure_text)
            VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
            ON CONFLICT (workspace_id) DO UPDATE
              SET auto_join_enabled = EXCLUDED.auto_join_enabled,
                  mode = EXCLUDED.mode,
                  allow = EXCLUDED.allow,
                  deny = EXCLUDED.deny,
                  opt_out_emails = EXCLUDED.opt_out_emails,
                  recording_disclosure_text = EXCLUDED.recording_disclosure_text,
                  updated_at = NOW()
            """,
            workspace_id,
            auto_join_enabled,
            (mode or MODE_ALL).lower(),
            json.dumps(allow or {}),
            json.dumps(deny or {}),
            json.dumps(opt_out_emails or []),
            recording_disclosure_text,
        )
        return await self.get(workspace_id)
