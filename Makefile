# =============================================================================
# Verdant meeting-assistant — full dev stack
# =============================================================================
#   make up      build + start the whole stack (postgres, ai-service, backend, web)
#   make down    stop and remove containers (keeps the DB volume)
#   make reset   stop + remove containers AND the DB volume (fresh schema)
#   make logs    follow logs for all services
#   make smoke   run the end-to-end cross-service smoke test
#   make smoke-botless  run the botless (desktop-capture) end-to-end smoke test
#   make ps      show service status
#   make psql    open a psql shell on the shared Postgres
# =============================================================================

COMPOSE := docker compose

.PHONY: up down reset logs smoke smoke-botless ps psql build env

# Create .env from the example on first run, then build + start detached.
up: env
	$(COMPOSE) up -d --build
	@echo ""
	@echo "Stack starting. Waiting for services to report healthy..."
	@echo "  web        -> http://localhost:$${WEB_PORT:-3001}"
	@echo "  backend    -> http://localhost:$${API_PORT:-8001}"
	@echo "  ai-service -> http://localhost:$${AI_PORT:-8101}/health"
	@echo ""
	@echo "Run 'make smoke' once services are healthy (see 'make ps')."

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
