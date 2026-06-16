#!/bin/bash
set -e
# Virtual framebuffer for headful Chromium + a window manager so the window is
# mapped at a real position (humanized X11 calibration reads window.screenX/Y).
Xvfb :99 -screen 0 1920x1080x24 >/dev/null 2>&1 &
sleep 1
fluxbox >/dev/null 2>&1 &
sleep 1
export DISPLAY=:99
echo "[entry] DISPLAY=$DISPLAY — running tools/${RUNNER:-docker-join-test.js}"
node "tools/${RUNNER:-docker-join-test.js}"
