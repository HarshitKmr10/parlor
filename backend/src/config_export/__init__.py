"""Configuration export — bundle the workspace's Parlor config as one JSON dict.

`ConfigExportService.build` aggregates the read-only config collections shipped
in this branch (tags, saved views, saved prompts, redaction rules, capture
exclusions, auto-tag rules, share settings, capture prefs) into a single
JSON-safe dict for backup and portability between self-hosted instances. Each
collection is fetched defensively — a single failing query is logged and yields
an empty value rather than failing the whole export.
"""

from .service import ConfigExportService

__all__ = ["ConfigExportService"]
