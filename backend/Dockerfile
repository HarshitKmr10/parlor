# Standalone meeting-joiner image.
#
# This Dockerfile builds the bot from ONLY the meeting-joiner/ directory.
# It does NOT depend on ../core or anywhere outside this folder, so the
# directory can be vendored into another repo and built with:
#
#   docker build -t meeting-joiner:local meeting-joiner/
#
# Monorepo deploys continue to use ../infra/docker/meeting_worker.Dockerfile
# and ../infra/docker/meeting_api.Dockerfile — those COPY core/ in for the
# Prisma adapter. This standalone image defaults to MEETING_JOINER_DB_DRIVER=pg.

FROM cgr.dev/chainguard/wolfi-base:latest

WORKDIR /app/meeting-joiner

# ── system deps (mirrors the monorepo image without the Zoom path) ──────
RUN apk update && apk upgrade && apk add --no-cache \
    python-3.12 py3.12-pip python-3.12-dev \
    gcc glibc-dev libatomic wget gnupg ca-certificates \
    build-base cmake ninja \
    postgresql-dev \
    libxrandr alsa-lib pango cairo gtk-3 gdk-pixbuf libxcomposite \
    libxcursor libxdamage libxi libxtst nss cups-libs libdrm mesa-gbm mesa \
    ffmpeg opus-dev \
    xvfb xauth xkeyboard-config xkbcomp xdpyinfo \
    pulseaudio pulseaudio-utils dbus \
    libx11-dev libxcb libxcb-dev libxfixes \
    bash font-liberation git curl \
    nodejs-22 npm

RUN pip3.12 install --upgrade pip && \
    ln -sf /usr/bin/python3.12 /usr/bin/python && \
    ln -sf /usr/bin/python3.12 /usr/bin/python3 && \
    ln -sf /usr/bin/pip3.12 /usr/bin/pip && \
    ln -sf /usr/bin/pip3.12 /usr/bin/pip3

# ── Chromium (Playwright runtime target) + openssl ──────────────────────
RUN apk add --no-cache chromium openssl && \
    CHROMIUM_BIN=$(find /usr -type f \( -name "chromium" -o -name "chromium-browser" \) -executable 2>/dev/null | head -1) && \
    if [ -z "$CHROMIUM_BIN" ]; then echo "ERROR: chromium not found" >&2; exit 1; fi && \
    ln -sf "$CHROMIUM_BIN" /usr/bin/chromium-browser && \
    test -x /usr/bin/chromium-browser

RUN npm install -g npm@latest pnpm@10.3.0
ENV NODE_ENV=production

# Poetry — pinned to 1.x for the same reasons the monorepo image pins it.
RUN pip3.12 install --no-cache-dir "poetry>=1.8,<2.0" && \
    poetry config virtualenvs.create false

# ── Python deps ─────────────────────────────────────────────────────────
# Standalone build path: poetry install without the optional 'prisma' group.
# If poetry's lockfile is out of date and fails, fall back to pip with the
# exact runtime set we know we need. Prisma is intentionally absent here —
# the standalone image uses MEETING_JOINER_DB_DRIVER=pg by default.
COPY pyproject.toml poetry.lock /app/meeting-joiner/
RUN poetry install --no-interaction --no-ansi --without dev 2>/dev/null \
    || poetry install --no-interaction --no-ansi --no-root --without dev 2>/dev/null \
    || pip3.12 install --no-cache-dir \
        fastapi uvicorn "asyncpg>=0.30,<1.0" pgqueuer==0.26.3 pydantic pydantic-settings \
        pyjwt openai python-dotenv structlog aiofiles psutil \
        httpx python-multipart docker

# ── Node deps ───────────────────────────────────────────────────────────
COPY package.json pnpm-lock.yaml /app/meeting-joiner/
RUN pnpm install --frozen-lockfile || pnpm install

# ── application source ──────────────────────────────────────────────────
COPY src     /app/meeting-joiner/src
COPY workers /app/meeting-joiner/workers
COPY shared  /app/meeting-joiner/shared
COPY db      /app/meeting-joiner/db
# .env is intentionally NOT copied; configuration arrives via process env.

RUN mkdir -p /tmp/zoom_transcripts /app/logs

ENV CHROME_BIN=/usr/bin/chromium-browser
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV FORCE_HEADLESS=false
ENV RUNNING_IN_DOCKER=true
ENV PYTHONPATH=/app/meeting-joiner:$PYTHONPATH
ENV NODE_PATH=/app/meeting-joiner/node_modules
ENV DISPLAY=:99
ENV HOME=/root
ENV XDG_RUNTIME_DIR=/tmp/runtime-root
ENV PULSE_SERVER=unix:/tmp/runtime-root/pulse/native
ENV PULSE_SINK=virtual_speaker
# Driver default for the standalone image — vendor consumers can override.
ENV MEETING_JOINER_DB_DRIVER=pg
# Run db/bootstrap.sql against $DATABASE_URL at container start when set.
ENV MEETING_JOINER_BOOTSTRAP_ON_START=false

COPY scripts/standalone-start.sh /app/start.sh
RUN chmod +x /app/start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD pgrep -f "Xvfb" > /dev/null && pgrep -f "pulseaudio" > /dev/null || exit 1

CMD ["/app/start.sh"]
