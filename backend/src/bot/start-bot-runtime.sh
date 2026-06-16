#!/bin/sh
#
# Bot-runtime container entrypoint.
#
# Starts the audio + display subsystems once per pod, then idles. The sidecar
# (in the adjacent container, shareProcessNamespace=true) spawns the
# per-meeting bot subprocess via POST /configure; this script's only job is
# to keep the pod alive with Xvfb + pulseaudio ready.
#
# Design notes:
# - We DO NOT spawn the bot here. The bot is started by sidecar after it
#   receives /configure with the meeting URL and config. Spawning here would
#   couple the lifecycle to env vars set at pod-create time, breaking the
#   warm-pool model.
# - On SIGTERM (k8s pod delete), we stop pulseaudio + Xvfb cleanly so any
#   in-flight audio writes are flushed. The sidecar handles bot SIGTERM
#   separately via its /abort handler.

set -eu

log() {
  # Plain JSON to stdout — picked up by Promtail / Loki via the standard
  # k8s log path. Matches the structlog format used by the Python services.
  printf '{"service":"bot-runtime","level":"info","event":"%s"}\n' "$1"
}

cleanup() {
  log "shutdown.signal_received"
  if [ -n "${PULSE_PID:-}" ] && kill -0 "$PULSE_PID" 2>/dev/null; then
    log "shutdown.stopping_pulseaudio"
    pulseaudio --kill || true
  fi
  if [ -n "${XVFB_PID:-}" ] && kill -0 "$XVFB_PID" 2>/dev/null; then
    log "shutdown.stopping_xvfb"
    kill "$XVFB_PID" || true
  fi
  log "shutdown.complete"
  exit 0
}

trap cleanup TERM INT

log "startup.begin"

# Xvfb headless display. Geometry tuned for Teams/Meet tile rendering;
# wider than 1080p so the people-pane fully fits without scrolling.
DISPLAY_NUM=${DISPLAY_NUM:-99}
export DISPLAY=":${DISPLAY_NUM}"
Xvfb "$DISPLAY" -screen 0 1920x1080x24 -nolisten tcp &
XVFB_PID=$!
log "startup.xvfb_started"

# Wait briefly for Xvfb to be ready — without this Chromium boot races.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# PulseAudio in system-less mode. Virtual sink + monitor source for the
# audio capture pipeline to read bot output (other-participants audio).
export PULSE_RUNTIME_PATH=/tmp/pulse-runtime
mkdir -p "$PULSE_RUNTIME_PATH"
pulseaudio \
  --exit-idle-time=-1 \
  --disallow-exit \
  --disable-shm=true \
  --log-target=stderr \
  --daemonize=no &
PULSE_PID=$!
log "startup.pulseaudio_started"

# Wait briefly for pulse socket to appear.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if pactl info >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# Virtual sink so we can capture audio coming out of the browser.
pactl load-module module-null-sink \
  sink_name=virtual_speaker \
  sink_properties=device.description=virtual_speaker >/dev/null || true
pactl set-default-sink virtual_speaker >/dev/null 2>&1 || true
log "startup.virtual_sink_ready"

# Pod-level heartbeat: the sidecar uses /tmp/pod.alive mtime as a coarse
# liveness signal (the bot's own /tmp/bot.heartbeat is finer-grained).
touch /tmp/pod.alive

log "startup.idle"

# Idle forever, refreshing the pod heartbeat every 5 s. The sidecar will
# spawn the actual bot process via POST /configure.
while true; do
  touch /tmp/pod.alive
  sleep 5
done
