"""On-pod disk cleanup after the bot exits.

Each meeting accumulates a handful of files under ``/tmp``:

* ``/tmp/meetings/{meeting_id}/`` — audio/video chunks the bot wrote
  out during the meeting.
* ``/tmp/zoom_transcripts/`` — Zoom SDK transcript exports.
* ``/tmp/msteams_meetings/{meeting_id}*`` — MSTeams scratch space.

The pod is ephemeral — kubelet will reclaim the disk when the pod
terminates — but during a long-running meeting these can balloon and
push the pod over its ephemeral-storage limit. After the bot's final
transcript flush, ``/abort`` calls into this module to upload any
remaining audio/video to Azure Blob and then delete the local files.

Operations are all best-effort: any single failure logs and moves on
so disk hygiene never blocks pod termination.
"""

from __future__ import annotations

import asyncio
import glob
import os
import shutil
from pathlib import Path
from typing import Iterable, Optional

from src.observability import get_logger

logger = get_logger(__name__)

# Limit which extensions we upload — JSON/transcript blobs are already
# persisted to the DB via the segment-write path; we only need the
# heavy media files to land in object storage so the user can replay
# them later.
_MEDIA_EXTENSIONS: tuple[str, ...] = (".wav", ".webm", ".mp4", ".m4a", ".opus")


class DiskHygiene:
    """Pod-side cleanup helper.

    Stateless; one instance can serve every ``/abort`` call.
    """

    def __init__(
        self,
        *,
        media_extensions: Iterable[str] = _MEDIA_EXTENSIONS,
    ) -> None:
        self._media_extensions = tuple(media_extensions)

    async def flush_and_cleanup(
        self,
        meeting_id: str,
        base_path: str = "/tmp/meetings",
    ) -> int:
        """Upload media + delete local scratch space for a meeting.

        Args:
            meeting_id: Which meeting's files to clean up.
            base_path: Override for the per-meeting directory root —
                helpful for tests but production uses the default.

        Returns:
            Total bytes freed from the local filesystem.
        """
        bytes_freed = 0
        meeting_dir = Path(base_path) / meeting_id

        if meeting_dir.exists() and meeting_dir.is_dir():
            bytes_freed += await self._upload_media_files(meeting_id, meeting_dir)
            bytes_freed += self._delete_dir(meeting_dir)

        # Sibling scratch dirs the bot may have populated.
        bytes_freed += self._cleanup_zoom_transcripts()
        bytes_freed += self._cleanup_msteams_meetings(meeting_id)

        # Asserts disk usage is bounded — emit a single structured log
        # line operators can scrape to alarm on runaway /tmp.
        try:
            total_bytes = self._du_total(base_path)
            logger.info(
                "disk_hygiene.summary",
                meeting_id=meeting_id,
                base_path=base_path,
                base_path_total_bytes=total_bytes,
                bytes_freed=bytes_freed,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "disk_hygiene.summary_failed",
                meeting_id=meeting_id,
                error=str(exc),
            )

        return bytes_freed

    # -- media upload -------------------------------------------------------

    async def _upload_media_files(
        self, meeting_id: str, meeting_dir: Path
    ) -> int:
        """Upload remaining media files to Azure Blob.

        Honors ``AZURE_STORAGE_CONNECTION_STRING`` +
        ``AZURE_STORAGE_CONTAINER_NAME``. If either is unset, we skip
        upload silently — the pod is ephemeral, so the worst case is
        the user loses an audio replay they never enabled.
        """
        connection_string = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        container_name = os.environ.get("AZURE_STORAGE_CONTAINER_NAME")
        if not connection_string or not container_name:
            logger.info(
                "disk_hygiene.upload_skipped_no_azure_config",
                meeting_id=meeting_id,
            )
            return 0

        uploaded_bytes = 0
        try:
            # Imported lazily so this module is importable even in
            # environments where azure-storage-blob isn't installed
            # (e.g. minimal lint containers).
            from azure.storage.blob.aio import BlobServiceClient
        except ImportError:
            logger.warning(
                "disk_hygiene.azure_sdk_missing",
                meeting_id=meeting_id,
            )
            return 0

        try:
            service_client = BlobServiceClient.from_connection_string(
                connection_string
            )
            try:
                container_client = service_client.get_container_client(
                    container_name
                )
                for media_path in self._iter_media_files(meeting_dir):
                    try:
                        size = await self._upload_one(
                            container_client, meeting_id, media_path
                        )
                        uploaded_bytes += size
                    except Exception as exc:  # noqa: BLE001
                        logger.warning(
                            "disk_hygiene.upload_failed",
                            meeting_id=meeting_id,
                            file=str(media_path),
                            error=str(exc),
                        )
            finally:
                await service_client.close()
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "disk_hygiene.upload_client_failed",
                meeting_id=meeting_id,
                error=str(exc),
            )
        return uploaded_bytes

    def _iter_media_files(self, meeting_dir: Path) -> Iterable[Path]:
        """Yield every media file under ``meeting_dir`` (recursive)."""
        for path in meeting_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() in self._media_extensions:
                yield path

    async def _upload_one(
        self, container_client, meeting_id: str, media_path: Path
    ) -> int:
        """Upload one file. Returns its size in bytes on success."""
        blob_name = f"{meeting_id}/{media_path.name}"
        size = media_path.stat().st_size
        with media_path.open("rb") as fh:
            data = fh.read()
        # Run the network call from the asyncio loop; the SDK's async
        # client handles the actual I/O off the event loop.
        await container_client.upload_blob(
            name=blob_name,
            data=data,
            overwrite=True,
        )
        logger.info(
            "disk_hygiene.upload_ok",
            meeting_id=meeting_id,
            blob_name=blob_name,
            size_bytes=size,
        )
        return size

    # -- local filesystem cleanup ------------------------------------------

    def _delete_dir(self, directory: Path) -> int:
        """Remove ``directory`` recursively. Returns bytes freed.

        Errors are logged and swallowed — disk hygiene must never block
        pod termination.
        """
        try:
            total = self._du_total(str(directory))
        except Exception:  # noqa: BLE001
            total = 0
        try:
            shutil.rmtree(directory, ignore_errors=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "disk_hygiene.rmtree_failed",
                path=str(directory),
                error=str(exc),
            )
            return 0
        return total

    def _cleanup_zoom_transcripts(self) -> int:
        """Wipe ``/tmp/zoom_transcripts/`` (single shared directory)."""
        target = Path("/tmp/zoom_transcripts")  # noqa: S108 — in-pod path
        if not target.exists():
            return 0
        return self._delete_dir(target)

    def _cleanup_msteams_meetings(self, meeting_id: str) -> int:
        """Wipe any ``/tmp/msteams_meetings/{meeting_id}*`` paths."""
        pattern = f"/tmp/msteams_meetings/{meeting_id}*"  # noqa: S108
        bytes_freed = 0
        for match in glob.glob(pattern):
            path = Path(match)
            try:
                if path.is_dir():
                    bytes_freed += self._delete_dir(path)
                elif path.is_file():
                    try:
                        size = path.stat().st_size
                    except OSError:
                        size = 0
                    try:
                        path.unlink()
                        bytes_freed += size
                    except OSError as exc:
                        logger.warning(
                            "disk_hygiene.unlink_failed",
                            path=str(path),
                            error=str(exc),
                        )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "disk_hygiene.msteams_cleanup_failed",
                    path=str(path),
                    error=str(exc),
                )
        return bytes_freed

    def _du_total(self, path: str) -> int:
        """``du -sh`` analogue — total bytes under ``path``.

        Implemented in pure Python to avoid forking a subprocess just
        for the disk-usage assertion log line. Best-effort: missing
        files mid-walk are silently skipped.
        """
        base = Path(path)
        if not base.exists():
            return 0
        total = 0
        for root, _dirs, files in os.walk(base, followlinks=False):
            for name in files:
                fp = Path(root) / name
                try:
                    total += fp.stat().st_size
                except OSError:
                    continue
        return total


_singleton: Optional[DiskHygiene] = None


def get_disk_hygiene() -> DiskHygiene:
    """Process-wide singleton accessor used by the sidecar route."""
    global _singleton
    if _singleton is None:
        _singleton = DiskHygiene()
    return _singleton


# Silence unused-symbol warnings — :func:`asyncio` is referenced
# implicitly via the async upload coroutine but ruff can't see it.
_ = asyncio
