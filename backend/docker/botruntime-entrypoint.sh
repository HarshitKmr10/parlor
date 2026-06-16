#!/usr/bin/env bash
#
# Bot-runtime entrypoint for the standalone backend image.
#
# Mirrors src/bot/start-bot-runtime.sh (Xvfb :99 + pulseaudio + virtual sink)
# but DOES NOT idle — it execs the passed command (uvicorn) so the SAME
# container serves the FastAPI API and hosts the bot subprocesses that
# LocalBotRunner spawns. Chromium launched by the bot renders onto DISPLAY=:99.
#
# Everything below is best-effort: a missing audio sink must not stop the API
# from booting. A failure to bring up the virtual display only degrades the
# bot join (it would fail with a real join error, never crash the API).

set -u

log() {
  printf '{"service":"bot-runtime","level":"info","event":"%s"}\n' "$1"
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
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${PULSE_PID:-}" ] && pulseaudio --kill 2>/dev/null || true
  [ -n "${XVFB_PID:-}" ] && kill "$XVFB_PID" 2>/dev/null || true
  log "shutdown.complete"
}
trap cleanup TERM INT

log "startup.exec_api"

# Exec the API. Run it in the background + wait so the trap can fire on SIGTERM
# (docker stop) and reap Xvfb/pulse cleanly.
"$@" &
API_PID=$!
wait "$API_PID"
