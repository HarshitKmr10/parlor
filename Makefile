# =============================================================================
# Verdant meeting-assistant — full dev stack
# =============================================================================
#   make up        build + start the whole stack (API-only backend image — fast)
#   make up-bots   build + start the stack with the FULL bot-runtime backend
#                  image (Node + Playwright Chromium + Xvfb/pulse/ffmpeg + local
#                  whisper). The backend then launches REAL meeting bots locally
#                  instead of degrading to bot_runtime_unavailable. Large/slow
#                  first build. See backend/docs/BOT-RUNTIME.md.
#   make down    stop and remove containers (keeps the DB volume)
#   make reset   stop + remove containers AND the DB volume (fresh schema)
#   make logs    follow logs for all services
#   make smoke   run the end-to-end cross-service smoke test
#   make smoke-botless  run the botless (desktop-capture) end-to-end smoke test
#   make ps      show service status
#   make psql    open a psql shell on the shared Postgres
# =============================================================================

COMPOSE := docker compose
# Layer the bot-runtime override on top of the base compose. Used by the
# *-bots targets so up/down/logs all target the same merged project.
COMPOSE_BOTS := docker compose -f docker-compose.yml -f docker-compose.botruntime.yml

.PHONY: up up-bots down down-bots reset logs logs-bots smoke smoke-botless ps psql build env

# Create .env from the example on first run, then build + start detached.
up: env
	$(COMPOSE) up -d --build
	@echo ""
	@echo "Stack starting (API-only backend). Waiting for services to report healthy..."
	@echo "  web        -> http://localhost:$${WEB_PORT:-3001}"
	@echo "  backend    -> http://localhost:$${API_PORT:-8001}"
	@echo "  ai-service -> http://localhost:$${AI_PORT:-8101}/health"
	@echo ""
	@echo "Run 'make smoke' once services are healthy (see 'make ps')."

# Full bot-runtime backend image (real Playwright/Node bots on Xvfb). The first
# build is large/slow (browser + node_modules + python deps). See
# backend/docs/BOT-RUNTIME.md.
up-bots: env
	$(COMPOSE_BOTS) up -d --build
	@echo ""
	@echo "Stack starting (FULL bot-runtime backend). Waiting for services to report healthy..."
	@echo "  web        -> http://localhost:$${WEB_PORT:-3001}"
	@echo "  backend    -> http://localhost:$${API_PORT:-8001}  (Node + Chromium + Xvfb)"
	@echo "  ai-service -> http://localhost:$${AI_PORT:-8101}/health"
	@echo ""
	@echo "Create a meeting via POST /api/v1/meetings to spawn a real bot."

# Tear down a bot-runtime stack (uses the merged project so all services stop).
down-bots:
	$(COMPOSE_BOTS) down

logs-bots:
	$(COMPOSE_BOTS) logs -f

build: env
	$(COMPOSE) build

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

psql:
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-meeting} -d $${POSTGRES_DB:-meeting}

# Run the end-to-end smoke test against the running stack.
smoke:
	./scripts/smoke_e2e.sh

# Run the botless (desktop-capture) end-to-end smoke test.
smoke-botless:
	./scripts/smoke_botless.sh

# Create .env from .env.example if it does not exist yet.
env:
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")
