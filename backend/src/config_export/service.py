"""Aggregate the workspace's Parlor configuration into one JSON-safe dict."""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable, Dict, List

from ..auto_tag import AutoTagRulesRepo
from ..capture_exclusions import CaptureExclusionsRepo
from ..capture_prefs import CapturePrefsRepo
from ..prompt_library import SavedPromptsRepo
from ..redaction import RedactionRulesRepo
from ..saved_views import SavedViewsRepo
from ..share_settings import ShareSettingsRepo
from ..tags import TagsRepo

logger = logging.getLogger(__name__)

EXPORT_VERSION = 1


def _json_safe(value: Any) -> Any:
    """Coerce raw DB rows to JSON-safe values (stringify UUIDs/datetimes)."""
    return json.loads(json.dumps(value, default=str))


class ConfigExportService:
    """Build a portable snapshot of a workspace's Parlor configuration.

    Read-only: every underlying repo call is a list/get. Each collection is
    fetched independently and defensively — one failing query is logged and
    yields an empty value instead of failing the whole export.
    """

    def __init__(self, db) -> None:
        self._db = db

    async def _safe_collection(
        self,
        key: str,
        fetch: Callable[[], Awaitable[Any]],
        empty: Any,
    ) -> Any:
        try:
            return _json_safe(await fetch())
        except Exception:  # noqa: BLE001 - one bad collection must not fail the export
            logger.exception("config_export: failed to load collection %s", key)
            return empty

    async def build(self, workspace_id: str) -> Dict[str, Any]:
        tags_repo = TagsRepo(self._db)
        saved_views_repo = SavedViewsRepo(self._db)
        prompts_repo = SavedPromptsRepo(self._db)
        redaction_repo = RedactionRulesRepo(self._db)
        exclusions_repo = CaptureExclusionsRepo(self._db)
        auto_tag_repo = AutoTagRulesRepo(self._db)
        share_repo = ShareSettingsRepo(self._db)
        capture_prefs_repo = CapturePrefsRepo(self._db)

        list_specs: List[tuple[str, Callable[[], Awaitable[Any]]]] = [
            ("tags", lambda: tags_repo.list(workspace_id)),
            ("savedViews", lambda: saved_views_repo.list(workspace_id)),
            ("prompts", lambda: prompts_repo.list(workspace_id)),
            ("redactionRules", lambda: redaction_repo.list(workspace_id)),
            ("captureExclusions", lambda: exclusions_repo.list(workspace_id)),
            ("autoTagRules", lambda: auto_tag_repo.list(workspace_id)),
        ]

        export: Dict[str, Any] = {"version": EXPORT_VERSION}
        for key, fetch in list_specs:
            export[key] = await self._safe_collection(key, fetch, [])

        export["shareSettings"] = await self._safe_collection(
            "shareSettings", lambda: share_repo.get(workspace_id), {}
        )
        export["capturePrefs"] = await self._safe_collection(
            "capturePrefs", lambda: capture_prefs_repo.get(workspace_id), {}
        )
        return export
