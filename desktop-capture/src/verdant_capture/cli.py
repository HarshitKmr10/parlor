"""``verdant-capture`` CLI — botless desktop audio capture for Verdant.

Captures local system/meeting audio, transcribes it (local faster-whisper, a
mock backend, or a remote STT), and streams transcript segments to the Verdant
backend so the transcript/summary flow runs WITHOUT a bot joining the call.
This complements the server-side joiner bots; it does not replace them.
"""

from __future__ import annotations

import signal
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from . import __version__
from .audio.capture import AudioSource
from .audio.devices import BLACKHOLE_SETUP_HELP, list_input_devices
from .client.api import VerdantClient
from .client.segments import Segment
from .config import load_config
from .errors import CaptureError
from .pipeline import CapturePipeline, synthetic_meeting_url
from .stt import build_backend

console = Console()
err_console = Console(stderr=True)

app = typer.Typer(
    add_completion=False,
    help=(
        "Botless desktop capture for Verdant — capture local meeting audio "
        "(no bot joins the call), transcribe it, and stream the transcript to "
        "the backend."
    ),
    no_args_is_help=True,
)


def _fail(message: str) -> None:
    """Print a clean error (no traceback) and exit non-zero."""
    err_console.print(f"[bold red]Error:[/] {message}")
    raise typer.Exit(code=1)


def _print_devices() -> None:
    try:
        devices = list_input_devices()
    except CaptureError as exc:
        _fail(str(exc))
        return
    if not devices:
        console.print("[yellow]No audio input devices found.[/]")
        console.print(BLACKHOLE_SETUP_HELP)
        return
    table = Table(title="Audio input devices")
    table.add_column("Index", justify="right")
    table.add_column("Name")
    table.add_column("Ch", justify="right")
    table.add_column("Rate", justify="right")
    table.add_column("Loopback")
    has_loopback = False
    for d in devices:
        has_loopback = has_loopback or d.is_loopback
        table.add_row(
            str(d.index),
            d.name,
            str(d.max_input_channels),
            f"{int(d.default_samplerate)}",
            "[green]yes[/]" if d.is_loopback else "no",
        )
    console.print(table)
    if not has_loopback:
        console.print(
            "\n[yellow]No loopback device detected[/] — system/meeting audio "
            "capture needs one. See setup help below.\n"
        )
        console.print(BLACKHOLE_SETUP_HELP)


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    list_devices: bool = typer.Option(
        False, "--list-devices", help="List audio input devices and exit."
    ),
    version: bool = typer.Option(
        False, "--version", help="Show version and exit."
    ),
) -> None:
    if version:
        console.print(f"verdant-capture {__version__}")
        raise typer.Exit()
    if list_devices:
        _print_devices()
        raise typer.Exit()
    if ctx.invoked_subcommand is None:
        console.print(ctx.get_help())
        raise typer.Exit()


@app.command()
def capture(
    meeting_url: Optional[str] = typer.Option(
        None,
        "--meeting-url",
        help=(
            "Real meeting URL (zoom/meet/teams) for the backend meeting row. "
            "Omit to use a synthetic desktop:// URL (local/offline only)."
        ),
    ),
    title: Optional[str] = typer.Option(None, "--title", help="Meeting title."),
    device: Optional[str] = typer.Option(
        None, "--device", help="Input device index or name substring."
    ),
    stt: str = typer.Option(
        "mock", "--stt", help="STT backend: mock | faster-whisper | remote."
    ),
    stt_model: str = typer.Option(
        "base", "--stt-model", help="faster-whisper model size (tiny/base/...)."
    ),
    stt_endpoint: Optional[str] = typer.Option(
        None, "--stt-endpoint", help="HTTP endpoint for the remote STT backend."
    ),
    chunk_seconds: float = typer.Option(
        5.0, "--chunk-seconds", min=1.0, help="Audio chunk length fed to STT."
    ),
    duration: Optional[float] = typer.Option(
        None, "--duration", help="Auto-stop after N seconds (else Ctrl-C)."
    ),
    speaker: str = typer.Option(
        "Speaker 1", "--speaker", help="Default speaker label when no diarization."
    ),
    transcript_out: Optional[Path] = typer.Option(
        None, "--transcript-out", help="Write a local JSONL transcript here."
    ),
    live: bool = typer.Option(
        True, "--live/--no-live", help="Print transcript lines as they arrive."
    ),
    local: bool = typer.Option(
        False,
        "--local",
        help="Offline mode: no backend, just capture + transcribe locally.",
    ),
    mock_audio: bool = typer.Option(
        False, "--mock-audio", help="Use a synthetic audio source (no hardware)."
    ),
    summarize: bool = typer.Option(
        True, "--summarize/--no-summarize", help="Trigger /summarize on stop."
    ),
    # config / auth overrides
    api_url: Optional[str] = typer.Option(None, "--api-url", help="Backend base URL."),
    api_key: Optional[str] = typer.Option(None, "--api-key", help="Workspace API key."),
    workspace_id: Optional[str] = typer.Option(
        None, "--workspace-id", help="Workspace id (JWT auth path)."
    ),
    email: Optional[str] = typer.Option(None, "--email", help="Login email."),
    password: Optional[str] = typer.Option(None, "--password", help="Login password."),
    ingest_path: Optional[str] = typer.Option(
        None,
        "--ingest-path",
        help="Override transcript ingest path (supports {meeting_id}).",
    ),
) -> None:
    """Capture system/meeting audio and stream the transcript to Verdant."""
    try:
        _run_capture(
            meeting_url=meeting_url,
            title=title,
            device=device,
            stt_name=stt,
            stt_model=stt_model,
            stt_endpoint=stt_endpoint,
            chunk_seconds=chunk_seconds,
            duration=duration,
            speaker=speaker,
            transcript_out=transcript_out,
            live=live,
            local=local,
            mock_audio=mock_audio,
            summarize=summarize,
            api_url=api_url,
            api_key=api_key,
            workspace_id=workspace_id,
            email=email,
            password=password,
            ingest_path=ingest_path,
        )
    except CaptureError as exc:
        _fail(str(exc))
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted.[/]")


def _run_capture(
    *,
    meeting_url: Optional[str],
    title: Optional[str],
    device: Optional[str],
    stt_name: str,
    stt_model: str,
    stt_endpoint: Optional[str],
    chunk_seconds: float,
    duration: Optional[float],
    speaker: str,
    transcript_out: Optional[Path],
    live: bool,
    local: bool,
    mock_audio: bool,
    summarize: bool,
    api_url: Optional[str],
    api_key: Optional[str],
    workspace_id: Optional[str],
    email: Optional[str],
    password: Optional[str],
    ingest_path: Optional[str],
) -> None:
    config = load_config(
        api_url=api_url,
        api_key=api_key,
        workspace_id=workspace_id,
        email=email,
        password=password,
        ingest_path=ingest_path,
    )

    # 1. Audio source
    source = AudioSource(
        device_selector=device,
        chunk_seconds=chunk_seconds,
        duration_sec=duration,
        mock=mock_audio,
    )
    if source.used_fallback:
        err_console.print(
            "[yellow]No loopback device found — falling back to the "
            "microphone.[/] Meeting audio quality will be limited.\n"
        )
        err_console.print(BLACKHOLE_SETUP_HELP)
    console.print(f"[bold]Audio source:[/] {source.description}")

    # 2. STT backend
    stt = build_backend(stt_name, model=stt_model, endpoint=stt_endpoint, api_key=api_key)
    console.print(f"[bold]STT backend:[/] {stt.name}")

    # 3. Backend + meeting
    client: Optional[VerdantClient] = None
    used_url = meeting_url or synthetic_meeting_url()
    meeting_id: Optional[str] = None

    if local:
        console.print("[bold]Mode:[/] local (offline) — no backend calls.")
    else:
        client = VerdantClient(config)
        mode = client.authenticate()
        console.print(f"[bold]Authenticated:[/] {mode}")
        if meeting_url is None:
            console.print(
                "[yellow]No --meeting-url given; the product API rejects "
                "synthetic desktop:// URLs. Falling back to --local for this "
                "run.[/] Pass a real meeting URL to create a backend meeting."
            )
            client.close()
            client = None
        else:
            created = client.create_meeting(
                meeting_url=used_url, title=title, scheduled_at=None
            )
            meeting_id = created.get("id")
            console.print(f"[bold]Meeting created:[/] {meeting_id} ({used_url})")

    # 4. Run pipeline
    transcript_path = transcript_out
    if transcript_path is None and (local or client is None):
        transcript_path = Path.cwd() / "verdant-transcript.jsonl"

    def _on_segment(seg: Segment) -> None:
        if live:
            ts = f"{seg.t_start_sec:6.1f}s"
            console.print(f"[dim]{ts}[/] [cyan]{seg.speaker_name}:[/] {seg.text}")

    def _on_status(msg: str) -> None:
        err_console.print(f"[yellow]·[/] {msg}")

    pipeline = CapturePipeline(
        source=source,
        stt=stt,
        client=client,
        default_speaker=speaker,
        on_segment=_on_segment,
        on_status=_on_status,
    )

    console.print(
        "[bold green]Capturing...[/] press Ctrl-C to stop"
        + (f" (auto-stop in {duration:.0f}s)" if duration else "")
    )
    # Ensure Ctrl-C surfaces as KeyboardInterrupt inside the loop.
    signal.signal(signal.SIGINT, signal.default_int_handler)

    result = pipeline.run(
        meeting_url=used_url, meeting_id=meeting_id, transcript_path=transcript_path
    )

    # 5. Finalize
    console.print(
        f"\n[bold]Captured[/] {len(result.segments)} segment(s)."
    )
    if result.transcript_path is not None:
        console.print(f"Local transcript: {result.transcript_path}")
    if client is not None and meeting_id is not None:
        if result.ingest_ok:
            console.print("[green]Segments streamed to backend.[/]")
        else:
            console.print(
                "[yellow]No public transcript-ingest endpoint was available[/] "
                "(set --ingest-path if your backend mounts one)."
            )
        try:
            client.stop_meeting(meeting_id)
            console.print("[green]Meeting finalized (status -> completed).[/]")
            if summarize:
                console.print("Triggering /summarize ...")
                insights = client.summarize(meeting_id)
                summary = (insights or {}).get("summary") or "(empty)"
                console.print(f"[bold]Summary:[/] {summary}")
        except CaptureError as exc:
            err_console.print(f"[yellow]Finalize step skipped:[/] {exc}")
        finally:
            client.close()

    stt.close()


if __name__ == "__main__":  # pragma: no cover
    app()
