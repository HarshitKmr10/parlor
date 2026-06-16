#!/usr/bin/env bash
# Minimal in-container init for the local-test image. Brings up the same
# X + audio plumbing prod uses (Xvfb on :99, PulseAudio with a
# virtual_speaker sink) so Chromium can launch headed and we can mirror
# Meet's pre-join-warning UX exactly.

set -euo pipefail

# Xvfb on :99 — Chromium reads $DISPLAY which is set in the Dockerfile.
# 1920x1080 matches the production --window-size flag.
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix
Xvfb :99 -screen 0 1920x1080x24 -ac +extension RANDR &
XVFB_PID=$!
# Give Xvfb a beat to bind /tmp/.X11-unix/X99 — without this Chromium
# may race the socket creation and report "Missing X server".
for _ in 1 2 3 4 5; do
  if [ -e /tmp/.X11-unix/X99 ]; then break; fi
  sleep 0.2
done

# DBus session needed by PulseAudio.
mkdir -p /var/run/dbus
dbus-daemon --system --fork >/dev/null 2>&1 || true

# Virtual audio sink chromium captures from. PULSE_SINK in the bot's
# browser.js points at this name.
pulseaudio --start --exit-idle-time=-1 --disallow-exit=true >/dev/null 2>&1 || true
pactl load-module module-null-sink sink_name=virtual_speaker \
  sink_properties=device.description=virtual_speaker >/dev/null 2>&1 || true
pactl set-default-sink virtual_speaker >/dev/null 2>&1 || true

# Hand off. Container CMD picks the script.
exec "$@"
