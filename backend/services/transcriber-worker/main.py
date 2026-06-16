"""Transcriber-worker — Phase 2 gRPC sidecar for the meeting-joiner.

Bootstrap entrypoint. Creates the gRPC server, registers the service,
binds 0.0.0.0:50051 by default, and runs until SIGTERM.

The actual transcription logic lives in `server.py`. Each gRPC stream
owns a `ResilientStreamerSession` that wraps the same provider adapters
the in-process Phase 1 implementation uses, just exposed via gRPC instead
of called directly. Client is the meeting-worker pod; per-session
routing is via `meeting_id` so a Resume can reconnect to the right state
on a different transcriber pod.

Dev: `python -m main` from inside the container or
`python services/transcriber-worker/main.py` from the repo root.
Prod: `gunicorn`-style we don't use; the Dockerfile CMD is `python -u
main.py` which gives line-buffered logs to stdout.

This is the Phase 2 scaffolding from the resilient-streaming plan. The
service boots and accepts connections today; the streaming session
lifecycle (`Resume` semantics, audio archive integration, speaker
binding) is what the next deploy iteration finishes.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time

# Imports for the generated proto stubs are deferred to server.py since
# codegen is run inside the container build (see Dockerfile).
from server import build_grpc_server

LOG = logging.getLogger("transcriber.worker")


async def _run() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
        stream=sys.stdout,
    )

    server, port = await build_grpc_server(
        host=os.environ.get("GRPC_HOST", "0.0.0.0"),
        port=int(os.environ.get("GRPC_PORT", "50051")),
    )
    await server.start()
    LOG.info("transcriber-worker listening on :%s", port)

    stop_event = asyncio.Event()

    def _stop_handler(*_args: object) -> None:
        LOG.info("shutdown signal received")
        stop_event.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, _stop_handler)
        except NotImplementedError:
            # Windows / unusual envs — fall back to default handlers.
            signal.signal(sig, _stop_handler)

    await stop_event.wait()
    LOG.info("draining active sessions before stop…")
    await server.stop(grace=30.0)
    LOG.info("transcriber-worker stopped cleanly")


def main() -> None:
    started = time.time()
    try:
        asyncio.run(_run())
    except Exception:  # pragma: no cover — top-level fail-loud
        LOG.exception("transcriber-worker crashed after %.1fs", time.time() - started)
        sys.exit(1)


if __name__ == "__main__":
    main()
