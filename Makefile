# =============================================================================
# Verdant meeting-assistant — full dev stack
# =============================================================================
#   make up        build + start the FULL SEPARATED stack (mirrors prod):
#                  web + backend (API) + meeting-worker (bot) + ai-service +
#                  postgres. The API runs RUNTIME_MODE=compose and DISPATCHES
#                  meetings to the SEPARATE meeting-worker container's sidecar
#                  over HTTP (POST /configure) — the worker spawns the real
#                  Playwright/Chromium bot on Xvfb. API and bot run in DISTINCT
#                  containers, just like prod (API pod ↔ warm-pool pod via Helm).
#                  First build is large/slow (Node + Chromium + node_modules +
#                  whisper cache). See backend/docs/BOT-RUNTIME.md.
#   make up-bots   alias for `make up` (kept for back-compat).
#   make up-api    API-ONLY for fast iteration: backend (lightweight Dockerfile.dev,
#                  RUNTIME_MODE=standalone, in-process degrade) + ai-service + web
#                  + postgres. No meeting-worker; bot dispatch degrades to
#                  bot_runtime_unavailable (no Node/Chromium in this image).
#   make down    stop and remove containers (keeps the DB volume)
#   make reset   stop + remove containers AND the DB volume (fresh schema)
#   make logs    follow logs for all services (separated stack)
#   make logs-worker  follow ONLY the meeting-worker (bot) logs
#   make smoke   run the end-to-end cross-service smoke test
#   make smoke-botless  run the botless (desktop-capture) end-to-end smoke test
#   make ps      show service status (separated stack)
#   make psql    open a psql shell on the shared Postgres
#   make build   build all images (separated stack)
# =============================================================================

COMPOSE := docker compose
# The separated stack: base compose + the meeting-worker override. This is the
# canonical project — up/down/logs/ps/build all target the merged project so
# every service is managed together.
COMPOSE_SEP := docker compose -f docker-compose.yml -f docker-compose.worker.yml
# API-only stack uses the base compose alone (backend = standalone in-process).
COMPOSE_API := docker compose

.PHONY: up up-bots up-api down reset logs logs-worker smoke smoke-botless ps psql build env

# Create .env from the example on first run, then build + start the SEPARATED
# stack detached (web + backend API + meeting-worker bot + ai-service + postgres).
up: env
	$(COMPOSE_SEP) up -d --build
	@echo ""
	@echo "Separated stack starting (API and bot in DISTINCT containers)."
	@echo "Waiting for services to report healthy..."
	@echo "  web            -> http://localhost:$${WEB_PORT:-3001}"
	@echo "  backend (API)  -> http://localhost:$${API_PORT:-8001}   (RUNTIME_MODE=compose)"
	@echo "  meeting-worker -> http://localhost:$${MEETING_WORKER_PORT:-9000}/   (sidecar; Node + Chromium + Xvfb)"
	@echo "  ai-service     -> http://localhost:$${AI_PORT:-8101}/health"
	@echo ""
	@echo "Create a meeting via POST /api/v1/meetings — the API dispatches it to"
	@echo "the meeting-worker container, which spawns the real bot. Watch the bot"
	@echo "with: make logs-worker"

# Back-compat alias: the old name for the bot-capable stack now IS the default.
up-bots: up

# API-only, fast iteration: lightweight backend image, in-process standalone.
up-api: env
	$(COMPOSE_API) up -d --build
	@echo ""
	@echo "API-only stack starting (no meeting-worker; standalone in-process degrade)."
	@echo "  web        -> http://localhost:$${WEB_PORT:-3001}"
	@echo "  backend    -> http://localhost:$${API_PORT:-8001}   (RUNTIME_MODE=standalone)"
	@echo "  ai-service -> http://localhost:$${AI_PORT:-8101}/health"

build: env
	$(COMPOSE_SEP) build

down:
	$(COMPOSE_SEP) down

reset:
	$(COMPOSE_SEP) down -v

logs:
	$(COMPOSE_SEP) logs -f

# Follow ONLY the meeting-worker logs — this is where the bot actually runs.
logs-worker:
	$(COMPOSE_SEP) logs -f meeting-worker

ps:
	$(COMPOSE_SEP) ps

psql:
	$(COMPOSE_SEP) exec postgres psql -U $${POSTGRES_USER:-meeting} -d $${POSTGRES_DB:-meeting}

# Run the end-to-end smoke test against the running stack.
smoke:
	./scripts/smoke_e2e.sh

# Run the botless (desktop-capture) end-to-end smoke test.
smoke-botless:
	./scripts/smoke_botless.sh

# Create .env from .env.example if it does not exist yet.
env:
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")
