"""Append-only audit log for sensitive actions.

`record_audit` is a best-effort writer (never raises into the calling action);
`AuditRepo` reads the workspace's recent events for the settings UI.
"""

from .repo import AuditRepo
from .service import record_audit

__all__ = ["AuditRepo", "record_audit"]
