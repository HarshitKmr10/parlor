#!/bin/bash
# Entry point for the standalone meeting-joiner image.
#
# Mirrors infra/docker/meeting_worker.Dockerfile's inline start.sh but
# additionally runs the schema bootstrap when
# MEETING_JOINER_BOOTSTRAP_ON_START=true, so consumer repos can stand the
# bot up against a fresh Postgres with one command.

set -e

echo "Starting standalone Meeting Joiner container"
echo "========================================"

# ── env loader sanity ───────────────────────────────────────────────────
if [ -z "${DATABASE_URL}" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  echo "See meeting-joiner/.env.example for the full env contract." >&2
  exit 1
fi

# ── optional bootstrap of the meeting_joiner schema ─────────────────────
if [ "${MEETING_JOINER_BOOTSTRAP_ON_START}" = "true" ]; then
  if ! command -v psql >/dev/null 2>&1; then
    echo "FATAL: MEETING_JOINER_BOOTSTRAP_ON_START=true but psql is not installed in the image." >&2
    exit 1
  fi
  echo "Applying db/bootstrap.sql..."
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f /app/meeting-joiner/db/bootstrap.sql
  echo "Bootstrap complete."
fi

# ── pulseaudio + xvfb runtime ───────────────────────────────────────────
export HOME=/root
export XDG_RUNTIME_DIR=/tmp/runtime-root
export PULSE_SERVER=unix:$XDG_RUNTIME_DIR/pulse/native
export PULSE_SINK=virtual_speaker
mkdir -p $XDG_RUNTIME_DIR
chmod 700 $XDG_RUNTIME_DIR

for cmd in pulseaudio pactl xdpyinfo; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "FATAL: required runtime command missing: $cmd" >&2
    exit 1
  fi
done

pulseaudio --kill >/dev/null 2>&1 || true
pulseaudio -D --exit-idle-time=-1 --log-target=stderr >/tmp/pulseaudio-start.log 2>&1 || true
for i in $(seq 1 20); do
  if pactl info >/dev/null 2>&1; then break; fi
  sleep 0.25
done
if ! pactl info >/dev/null 2>&1; then
  echo "FATAL: PulseAudio failed to start" >&2
  exit 1
fi

pactl load-module module-null-sink sink_name=virtual_speaker \
  sink_properties=device.description=Virtual_Speaker >/dev/null 2>&1 || true
pactl set-default-sink virtual_speaker
pactl set-default-source virtual_speaker.monitor || true

Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!
export DISPLAY=:99

for i in $(seq 1 30); do
  if [ -S /tmp/.X11-unix/X99 ]; then break; fi
  sleep 0.5
done
if [ ! -S /tmp/.X11-unix/X99 ]; then
  echo "FATAL: Xvfb failed to bind /tmp/.X11-unix/X99" >&2
  cat /tmp/xvfb.log >&2
  exit 1
fi

trap "kill $XVFB_PID 2>/dev/null || true; pulseaudio --kill 2>/dev/null || true" EXIT INT TERM

echo "Runtime ready (driver=${MEETING_JOINER_DB_DRIVER:-prisma})"
exec python3 workers/pgqueuer_worker.py
