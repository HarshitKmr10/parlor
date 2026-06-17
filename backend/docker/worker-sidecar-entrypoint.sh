#!/usr/bin/env bash
#
# meeting-worker entrypoint for the separated compose stack.
#
# Same shape as botruntime-entrypoint.sh (Xvfb :99 + pulseaudio + virtual
# sink) but instead of execing the FastAPI *API* (src.main), it execs the
# *sidecar* control-plane FastAPI app (src.sidecar.main). The sidecar's
# POST /configure spawns the real Playwright/Node meeting bot, which renders
# headful Chromium onto DISPLAY=:99 inside THIS container — separate from the
# backend API container that dispatched it.
#
# Best-effort: a missing audio sink / display only degrades the bot join (it
# fails with a real join error), it never stops the sidecar from booting and
# accepting /configure.

set -u

log() {
  printf '{"service":"meeting-worker","level":"info","event":"%s"}\n' "$1"
}

DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"
export HOME="${HOME:-/root}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-root}"
mkdir -p "$XDG_RUNTIME_DIR" 2>/dev/null || true
chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true

# ── Virtual display ──────────────────────────────────────────────────────────
log "startup.xvfb_starting"
Xvfb "$DISPLAY" -screen 0 1920x1080x24 -ac +extension GLX +render -nolisten tcp -noreset &
XVFB_PID=$!

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
  log "startup.xvfb_ready"
else
  log "startup.xvfb_check_failed"
fi

# ── Virtual audio (pulseaudio system-less) ───────────────────────────────────
export PULSE_RUNTIME_PATH=/tmp/pulse-runtime
mkdir -p "$PULSE_RUNTIME_PATH" 2>/dev/null || true
log "startup.pulseaudio_starting"
pulseaudio \
  --exit-idle-time=-1 \
  --disallow-exit \
  --disable-shm=true \
  --log-target=stderr \
  --daemonize=no >/dev/null 2>&1 &
PULSE_PID=$!

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if pactl info >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
pactl load-module module-null-sink \
  sink_name=virtual_speaker \
  sink_properties=device.description=virtual_speaker >/dev/null 2>&1 || true
pactl set-default-sink virtual_speaker >/dev/null 2>&1 || true
if pactl info >/dev/null 2>&1; then
  log "startup.virtual_sink_ready"
else
  log "startup.pulseaudio_unavailable"
fi

# ── Cleanup on shutdown ──────────────────────────────────────────────────────
cleanup() {
  log "shutdown.signal_received"
  [ -n "${SIDECAR_PID:-}" ] && kill "$SIDECAR_PID" 2>/dev/null || true
  [ -n "${PULSE_PID:-}" ] && pulseaudio --kill 2>/dev/null || true
  [ -n "${XVFB_PID:-}" ] && kill "$XVFB_PID" 2>/dev/null || true
  log "shutdown.complete"
}
trap cleanup TERM INT

log "startup.exec_sidecar"

# Exec the sidecar control plane. Run it in the background + wait so the trap
# can fire on SIGTERM (docker stop) and reap Xvfb/pulse cleanly.
"$@" &
SIDECAR_PID=$!
wait "$SIDECAR_PID"
