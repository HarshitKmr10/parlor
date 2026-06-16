# Dev convenience targets for the standalone backend + /api/v1 product layer.
.PHONY: dev dev-build dev-down dev-logs dev-psql migrate

COMPOSE := docker compose -f docker-compose.dev.yml --env-file .env.dev

# Bring up Postgres (pgvector) + the FastAPI backend in standalone mode.
# Creates .env.dev from the example on first run.
dev:
	@test -f .env.dev || cp .env.dev.example .env.dev
	$(COMPOSE) up --build

dev-build:
	@test -f .env.dev || cp .env.dev.example .env.dev
	$(COMPOSE) build

dev-down:
	$(COMPOSE) down

# Also remove the DB volume (fresh schema on next `make dev`).
dev-reset:
	$(COMPOSE) down -v

dev-logs:
	$(COMPOSE) logs -f api

dev-psql:
	$(COMPOSE) exec db psql -U meeting -d meeting

# Re-apply the auth/product + calendar/integrations migrations (idempotent).
migrate:
	$(COMPOSE) exec -T db psql -U meeting -d meeting < db/0002_product_auth.sql
	$(COMPOSE) exec -T db psql -U meeting -d meeting < db/0003_calendar_integrations.sql
