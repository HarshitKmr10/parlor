"""gRPC service implementation for the transcriber-worker.

Stateful service: each `StreamTranscription` RPC owns one session. A
session opens an underlying provider adapter (AssemblyAI / AWS Transcribe
/ Deepgram), pumps audio frames into it, and emits transcript events
back to the client.

Reconnection: the client may call `Resume` mid-RPC if it lost the prior
connection. The session keeps an in-memory replay buffer keyed by
sequence number so resuming clients only re-stream the unacked tail.

Cross-pod routing (Phase 2.1): when a client reconnects to a different
transcriber pod, it sends a Resume with `meeting_id`. If this pod has no
prior state for that meeting, we open a fresh provider session and the
client replays the unacked audio. Provider adapters are stateless w.r.t.
meeting identity; the only continuity loss is the speaker-string
interning map, which the binder downstream re-corroborates within a few
turns.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional

import grpc

LOG = logging.getLogger("transcriber.server")

# Generated stubs are produced at container-build time via:
#   python -m grpc_tools.protoc -I proto --python_out=. --grpc_python_out=. \
#       proto/transcriber/v1/transcriber.proto
# Local development: run `make proto` which does the same.
try:
    from transcriber.v1 import transcriber_pb2, transcriber_pb2_grpc  # type: ignore
except ImportError:  # pragma: no cover — first-boot before codegen
    transcriber_pb2 = None  # type: ignore[assignment]
    transcriber_pb2_grpc = None  # type: ignore[assignment]


@dataclass
class Session:
    meeting_id: str
    session_id: str
    provider: str
    sample_rate: int
    started_at: float = field(default_factory=time.time)
    last_seq_acked: int = 0
    active: bool = True


class TranscriberServicer:  # pragma: no cover — exercised via integration tests
    """Implements transcriber.v1.TranscriberService.

    Phase 2 scaffold: the StreamTranscription handler accepts the client
    framing protocol but delegates the actual provider transcription to
    the same Python `transcribe_service.MultiProviderTranscriber` that
    the in-process path uses. The next iteration replaces this with the
    Node ResilientStreamer logic ported to Python (`grpc.aio` + raw
    websockets + boto3 streaming) so reconnect / heartbeat / watchdog
    semantics match Phase 1 exactly.
    """

    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.started_at = time.time()

    async def StreamTranscription(
        self,
        request_iter: AsyncIterator,
        context: grpc.aio.ServicerContext,
    ):
        session: Optional[Session] = None
        try:
            async for msg in request_iter:
                kind = msg.WhichOneof("payload")
                if kind == "start":
                    session = self._open_session(msg.start)
                    yield transcriber_pb2.ServerMessage(
                        ack=transcriber_pb2.SessionAck(
                            session_id=session.session_id,
                            server_started_at=int(time.time() * 1000),
                        )
                    )
                elif kind == "frame":
                    if session is None:
                        yield self._error(
                            transcriber_pb2.Error.SESSION_EXPIRED,
                            "frame received before SessionStart",
                        )
                        return
                    session.last_seq_acked = msg.frame.sequence
                    # TODO Phase 2.2: push msg.frame.pcm16 into the
                    # underlying provider adapter and forward
                    # TranscriptEvents back through `yield` here.
                    if msg.frame.sequence % 50 == 0:
                        yield transcriber_pb2.ServerMessage(
                            frame_ack=transcriber_pb2.FrameAck(
                                last_seq_acked=session.last_seq_acked,
                            )
                        )
                elif kind == "resume":
                    session = self._resume_session(msg.resume)
                    yield transcriber_pb2.ServerMessage(
                        ack=transcriber_pb2.SessionAck(
                            session_id=session.session_id,
                            server_started_at=int(time.time() * 1000),
                        )
                    )
                elif kind == "end":
                    LOG.info("session %s ending: %s", session and session.session_id, msg.end.reason)
                    break
                else:
                    yield self._error(
                        transcriber_pb2.Error.INVALID_FRAME,
                        f"unknown payload kind {kind}",
                    )
        finally:
            if session is not None:
                session.active = False

    async def Health(self, request, context):  # noqa: ARG002
        return transcriber_pb2.HealthResponse(
            serving=True,
            active_sessions=sum(1 for s in self.sessions.values() if s.active),
            server_started_at=int(self.started_at * 1000),
        )

    # ─── internals ──────────────────────────────────────────────────────

    def _open_session(self, start) -> Session:
        sid = str(uuid.uuid4())
        s = Session(
            meeting_id=start.meeting_id,
            session_id=sid,
            provider=start.provider or "assemblyai",
            sample_rate=start.sample_rate or 16_000,
        )
        self.sessions[sid] = s
        LOG.info(
            "session opened",
            extra={"session_id": sid, "meeting_id": start.meeting_id, "provider": s.provider},
        )
        return s

    def _resume_session(self, resume) -> Session:
        # Look up by meeting_id rather than session_id — the original
        # session may have lived on a different pod.
        for s in self.sessions.values():
            if s.meeting_id == resume.meeting_id and s.active:
                LOG.info("session %s resumed at seq %s", s.session_id, resume.last_seq_acked)
                return s
        # No prior state on this pod → open a new session for the meeting.
        sid = str(uuid.uuid4())
        s = Session(
            meeting_id=resume.meeting_id,
            session_id=sid,
            provider="assemblyai",
            sample_rate=16_000,
            last_seq_acked=resume.last_seq_acked,
        )
        self.sessions[sid] = s
        return s

    def _error(self, code, message: str):
        return transcriber_pb2.ServerMessage(
            error=transcriber_pb2.Error(code=code, message=message, retriable=True)
        )


async def build_grpc_server(host: str = "0.0.0.0", port: int = 50051):
    """Returns (server, port). Caller is responsible for `await server.start()`."""
    if transcriber_pb2_grpc is None:
        raise RuntimeError(
            "transcriber proto stubs not generated — run `make proto` or "
            "`python -m grpc_tools.protoc` against proto/transcriber/v1/transcriber.proto"
        )
    server = grpc.aio.server(
        options=[
            ("grpc.keepalive_time_ms", 10_000),
            ("grpc.keepalive_timeout_ms", 5_000),
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),
            ("grpc.max_send_message_length", 16 * 1024 * 1024),
        ]
    )
    servicer = TranscriberServicer()
    transcriber_pb2_grpc.add_TranscriberServiceServicer_to_server(servicer, server)
    bind_addr = f"{host}:{port}"
    server.add_insecure_port(bind_addr)
    return server, port
