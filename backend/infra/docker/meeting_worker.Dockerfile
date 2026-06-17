FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Set the working directory in the container
WORKDIR /app/meeting-joiner

# Install system dependencies for both MS Teams (Puppeteer) and Zoom SDK
RUN apt-get update && apt-get install -y \
    # Python and build tools
    python3 python3-dev python3-pip \
    gcc g++ libpq-dev wget gnupg ca-certificates libatomic1 \
    build-essential cmake ninja-build \
    # Browser dependencies
    libxss1 libxrandr2 libasound2 \
    libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 \
    libgtk-3-0 libgtk-3-dev libgdk-pixbuf-2.0-0 libxcomposite1 \
    libxcursor1 libxdamage1 libxi6 libxtst6 \
    libnss3 libcups2 libdrm2 libgbm1 libgl1-mesa-dri \
    # Audio/Video processing
    ffmpeg libopus-dev \
    libasound2-plugins alsa-utils \
    # Virtual display
    xvfb xauth \
    # XTEST OS-level input for the humanized Google Meet join layer
    # (isTrusted:true clicks). Without these the bot falls back to synthetic
    # clicks (isTrusted:false) — the exact signal Google's bot detection flags.
    xdotool xclip \
    # PulseAudio for virtual audio capture
    pulseaudio pulseaudio-utils libdbus-1-3 \
    # PyGObject/GLib dependencies for Zoom SDK (CRITICAL for gi module)
    gobject-introspection libgirepository1.0-dev libcairo2-dev \
    gir1.2-glib-2.0 python3-gi python3-gi-cairo pkg-config \
    libglib2.0-0 libglib2.0-dev \
    # X11 dependencies
    libx11-dev libx11-xcb1 libxcb-image0 libxcb-keysyms1 \
    libxcb-randr0 libxcb-shape0 libxcb-shm0 libxcb-xfixes0 \
    libxcb-xtest0 libxfixes3 \
    # Additional utilities
    fonts-liberation libvulkan1 xdg-utils git curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && echo "🔍 Verifying installations..." \
    && ffmpeg -version | head -1 \
    && which ffmpeg \
    && ls -la /usr/bin/ffmpeg \
    && echo "✅ FFmpeg verified" \
    && pactl --version | head -1 \
    && echo "✅ PulseAudio verified"

# Install Google Chrome on amd64 only (Chrome has no Linux arm64 build).
# On arm64, the bot falls back to Playwright's bundled Chromium (installed
# below at the npx playwright install step). CHROME_BIN is set later
# accordingly.
RUN if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
      wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg && \
      sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list' && \
      apt-get update && \
      wget -O /tmp/google-chrome-stable_138.0.7204.168-1_amd64.deb https://dl.google.com/linux/chrome/deb/pool/main/g/google-chrome-stable/google-chrome-stable_138.0.7204.168-1_amd64.deb && \
      dpkg -i /tmp/google-chrome-stable_138.0.7204.168-1_amd64.deb || apt-get -f install -y && \
      apt-mark hold google-chrome-stable && \
      rm -f /tmp/google-chrome-stable_138.0.7204.168-1_amd64.deb && \
      rm -rf /var/lib/apt/lists/* && \
      echo "✅ Google Chrome installed: $(google-chrome --version)"; \
    else \
      echo "⏭ Skipping Chrome on arm64 (using Playwright Chromium fallback)"; \
    fi

# Install PNPM
RUN npm install -g pnpm
ENV NODE_ENV=production

# Install Zoom Meeting SDK from PyPI (amd64-only — no arm64 wheels exist).
# On arm64 the bot can still join Meet/Teams via Playwright; Zoom support
# is just unavailable. Don't fail the build.
RUN if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
      pip3 install --no-cache-dir zoom-meeting-sdk && \
      echo "✅ Zoom Meeting SDK installed from PyPI"; \
    else \
      echo "⏭ Skipping Zoom SDK on arm64 (no wheel published)"; \
    fi

# Install Poetry (pinned to 1.x — 2.x removes legacy flags and breaks fallback)
RUN pip3 install --no-cache-dir "poetry>=1.8,<2.0" && \
    poetry config virtualenvs.create false

# Copy core directory FIRST (needed for Poetry dependencies)
COPY core /app/core

# Copy Python dependency manifests
COPY meeting-joiner/pyproject.toml meeting-joiner/poetry.lock /app/meeting-joiner/

# Install Python dependencies (main + zoom group)
# Note: Using --without dev instead of --only main to allow --with zoom to work
# pgqueuer is pinned to 0.25.1 in the fallback because 1.0.0 renamed
# RetryWithBackoffEntrypointExecutor → DatabaseRetryEntrypointExecutor.
RUN poetry install --no-interaction --no-ansi --without=dev --with=zoom || \
    pip3 install --no-cache-dir \
        fastapi uvicorn asyncpg pgqueuer==0.25.1 pydantic pydantic-settings \
        pyjwt openai python-dotenv structlog prisma aiofiles psutil \
        httpx python-multipart docker \
        opentelemetry-api opentelemetry-sdk \
        opentelemetry-exporter-otlp opentelemetry-exporter-otlp-proto-grpc \
        opentelemetry-instrumentation-fastapi \
        opentelemetry-instrumentation-asyncpg \
        opentelemetry-instrumentation-httpx \
        opentelemetry-instrumentation-logging \
        kubernetes-asyncio \
        prometheus-client

# Copy Node.js dependencies manifests
COPY meeting-joiner/package.json /app/meeting-joiner/
COPY meeting-joiner/pnpm-lock.yaml /app/meeting-joiner/
# Skip puppeteer's chrome-headless-shell download (never used; the bot uses the
# Playwright chromium / system Chrome installed below). Avoids wasted disk/ENOSPC.
RUN PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install

# Install Playwright browser for Google Meet support
# Using system Chrome as fallback, but also install Playwright chromium for best compatibility.
# Install into a shared, world-readable path (not /root/.cache) so a non-root
# runtime user (uid 1001, see below) can read the browser. See RCA #22.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN npx playwright install chromium && \
    npx playwright install-deps chromium && \
    chmod -R a+rX /opt/ms-playwright && \
    echo "✅ Playwright chromium installed for Google Meet support"

# Copy Prisma schema
WORKDIR /app
COPY core/core/db/prisma/ /app/core/core/db/prisma/

# Generate Prisma client at build time
# Note: Skipping prisma generate on arm64 Mac builds due to Rosetta compatibility issues
# For production builds on x86_64, uncomment the lines below:
# WORKDIR /app/core/core/db
# RUN prisma generate
WORKDIR /app/core/core/db
RUN prisma generate || echo "⚠️ Prisma generate skipped (may fail on arm64 emulation)"

# Copy application source code
WORKDIR /app/meeting-joiner
COPY meeting-joiner/src /app/meeting-joiner/src
COPY meeting-joiner/workers /app/meeting-joiner/workers
COPY meeting-joiner/shared /app/meeting-joiner/shared
COPY meeting-joiner/.env /app/meeting-joiner/.env

# Create necessary directories
RUN mkdir -p /tmp/zoom_transcripts /app/logs

# Non-root runtime user (uid 1001), matching the sidecar image so shared
# volumes are accessible. The image still DEFAULTS to root (no USER directive)
# for backward compatibility; the K8s securityContext opts into uid 1001 only
# when meetingJoiner.security.runAsNonRoot=true. See RCA #22.
#
# A non-root user needs writable HOME / XDG_RUNTIME_DIR and read access to the
# app + browser cache. start-bot-runtime.sh / start.sh resolve runtime paths
# under /tmp (group-writable) so both root and 1001 work.
RUN groupadd -r meetingworker -g 1001 \
    && useradd -r -u 1001 -g meetingworker -d /home/meetingworker -m meetingworker \
    && mkdir -p /home/meetingworker /tmp/runtime-1001 \
    && chmod 700 /tmp/runtime-1001 \
    && chown -R 1001:1001 /home/meetingworker /tmp/runtime-1001 \
                          /app/logs /tmp/zoom_transcripts \
    && chown -R 1001:1001 /app/meeting-joiner/node_modules 2>/dev/null || true

# Set environment variables
ENV CHROME_BIN=/usr/bin/google-chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV FORCE_HEADLESS=false
ENV RUNNING_IN_DOCKER=true
ENV PYTHONPATH=/app/meeting-joiner:/app:$PYTHONPATH
ENV NODE_PATH=/app/meeting-joiner/node_modules
ENV DISPLAY=:99
ENV HOME=/root
ENV XDG_RUNTIME_DIR=/tmp/runtime-root

# Create comprehensive startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "🚀 Starting Meeting Worker Container"\n\
echo "========================================"\n\
\n\
# Set up PulseAudio environment\n\
export HOME=/root\n\
export XDG_RUNTIME_DIR=/tmp/runtime-root\n\
mkdir -p $XDG_RUNTIME_DIR\n\
chmod 700 $XDG_RUNTIME_DIR\n\
\n\
# Start PulseAudio for audio capture\n\
echo "🔊 Starting PulseAudio..."\n\
pulseaudio -D --exit-idle-time=-1 2>&1 | grep -v "not intended to be run as root" || true\n\
sleep 2\n\
\n\
# Create virtual audio sink for capture\n\
echo "🎵 Creating virtual audio sink..."\n\
pactl load-module module-null-sink sink_name=virtual_speaker sink_properties=device.description=Virtual_Speaker || true\n\
pactl set-default-sink virtual_speaker || true\n\
echo "✅ Virtual audio configured"\n\
\n\
# Start Xvfb (virtual display)\n\
echo "🖥️  Starting virtual display (Xvfb)..."\n\
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &\n\
XVFB_PID=$!\n\
export DISPLAY=:99\n\
\n\
# Wait for Xvfb to be ready\n\
sleep 2\n\
\n\
# Runtime Verification\n\
echo ""\n\
echo "🔍 Runtime Verification"\n\
echo "========================"\n\
\n\
# Verify FFmpeg\n\
if command -v ffmpeg >/dev/null 2>&1; then\n\
  echo "✅ FFmpeg found: $(which ffmpeg)"\n\
  ffmpeg -version | head -1\n\
else\n\
  echo "❌ FFmpeg not found in PATH"\n\
  exit 1\n\
fi\n\
\n\
# Verify Google Chrome\n\
if command -v google-chrome >/dev/null 2>&1; then\n\
  echo "✅ Google Chrome found: $(which google-chrome)"\n\
  google-chrome --version\n\
else\n\
  echo "❌ Google Chrome not found in PATH"\n\
  exit 1\n\
fi\n\
\n\
# Verify PulseAudio\n\
if pactl info >/dev/null 2>&1; then\n\
  echo "✅ PulseAudio is running"\n\
  echo "   Available sinks:"\n\
  pactl list short sinks | sed "s/^/   /"\n\
else\n\
  echo "⚠️  PulseAudio might not be running (audio capture may fail)"\n\
fi\n\
\n\
# Verify Xvfb\n\
if xdpyinfo -display :99 >/dev/null 2>&1; then\n\
  echo "✅ Xvfb virtual display is active"\n\
else\n\
  echo "⚠️  Xvfb display check failed"\n\
fi\n\
\n\
# Verify PyGObject/GLib\n\
if python3 -c "import gi; gi.require_version('\''GLib'\'', '\''2.0'\''); from gi.repository import GLib; print('\''GLib version:'\'', GLib.MAJOR_VERSION, GLib.MINOR_VERSION)" 2>/dev/null; then\n\
  echo "✅ PyGObject and GLib available for Zoom SDK"\n\
else\n\
  echo "⚠️  PyGObject/GLib not available (Zoom SDK features disabled)"\n\
fi\n\
\n\
# Verify Zoom Meeting SDK\n\
if python3 -c "import zoom_meeting_sdk; print('\''Zoom SDK version:'\'', zoom_meeting_sdk.__version__ if hasattr(zoom_meeting_sdk, '\''__version__'\'') else '\''installed'\'')" 2>/dev/null; then\n\
  echo "✅ Zoom Meeting SDK available"\n\
else\n\
  echo "⚠️  Zoom Meeting SDK not available (Zoom meeting features disabled)"\n\
fi\n\
\n\
# Check ffmpeg-static package\n\
if [ -f /app/meeting-joiner/node_modules/ffmpeg-static/ffmpeg ]; then\n\
  echo "✅ ffmpeg-static package available"\n\
else\n\
  echo "ℹ️  Using system FFmpeg (recommended)"\n\
fi\n\
\n\
# Verify Playwright\n\
if npx playwright --version >/dev/null 2>&1; then\n\
  echo "✅ Playwright available for Google Meet: $(npx playwright --version)"\n\
else\n\
  echo "⚠️  Playwright not available (Google Meet features may be limited)"\n\
fi\n\
\n\
echo ""\n\
echo "🎬 All systems ready - Starting worker"\n\
echo "========================================"\n\
\n\
# Trap to cleanup processes on exit\n\
trap "echo Cleaning up...; kill $XVFB_PID 2>/dev/null || true; pulseaudio --kill 2>/dev/null || true" EXIT INT TERM\n\
\n\
# Start your worker\n\
exec python3 workers/pgqueuer_worker.py' > /app/start.sh \
&& chmod +x /app/start.sh

# Health check to ensure services are running
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -f "Xvfb" > /dev/null && pgrep -f "pulseaudio" > /dev/null || exit 1

# Run the worker
CMD ["/app/start.sh"]
