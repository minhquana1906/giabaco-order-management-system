COMPOSE_PROD := docker compose -f docker-compose.yml
SMOKE := docker compose -p gsmoke --env-file .env.smoke -f docker-compose.yml
SMOKE_PASSWORD := smoke-pass-123

.DEFAULT_GOAL := help
.PHONY: help setup seed-demo dev dev-reset dev-api dev-web test lint smoke hash up logs staff

help: ## Show targets
	@grep -E '^[a-zA-Z_./-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-22s %s\n", $$1, $$2}'

backend/.env.local: ## Create dev env file (prompts for admin password)
	@cd backend && HASH=$$(uv run python -m app.core.security hash-password) && \
	printf '%s\n' \
	  'DATABASE_URL=postgresql+psycopg://guniform:guniform_dev@127.0.0.1:55432/guniform' \
	  "SESSION_SECRET=$$(openssl rand -hex 32)" \
	  'ADMIN_USERNAME=admin' \
	  "ADMIN_PASSWORD_HASH='$$HASH'" \
	  'PUBLIC_BASE_URL=http://127.0.0.1:5173' \
	  'COOKIE_SECURE=false' > .env.local

setup: backend/.env.local ## Local: start DBs, install deps, migrate, seed (re-run after editing the seed)
	docker compose up -d --wait db db-test
	cd backend && uv sync && uv run alembic upgrade head && uv run python -m app.features.catalog.seed config/catalog.seed.yaml
	cd frontend && pnpm install

seed-demo: ## Local: load varied synthetic demo data (no-op if students exist)
	cd backend && uv run python -m scripts.seed_demo

dev-reset: ## Local: reset dev DB (re-run after editing the seed)
	docker compose down -v
	POSTGRES_PASSWORD=guniform_dev make setup
	make seed-demo
	make dev

dev: ## Local: backend :8000 + frontend :5173
	$(MAKE) -j2 dev-api dev-web

dev-api:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-web:
	cd frontend && pnpm dev

test: ## Backend + frontend tests
	docker compose up -d --wait db-test
	cd backend && uv run pytest -q
	cd frontend && pnpm test

lint: ## ruff, mypy, eslint, tsc
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app
	cd frontend && pnpm lint && pnpm typecheck

smoke: ## Build the production image and smoke it (isolated project, then cleaned up)
	@cd backend && HASH=$$(uv run python -c "from app.core.security import hash_password as h; print(h('$(SMOKE_PASSWORD)'))") && \
	printf '%s\n' 'POSTGRES_PASSWORD=smokepw' "SESSION_SECRET=$$(openssl rand -hex 32)" 'ADMIN_USERNAME=admin' \
	  "ADMIN_PASSWORD_HASH='$$HASH'" 'TUNNEL_TOKEN=unused' 'PUBLIC_BASE_URL=http://parent.smoke' 'ADMIN_HOST=admin.smoke' 'COOKIE_SECURE=false' > ../.env.smoke
	@$(SMOKE) up -d --build db app; rc=$$?; \
	[ $$rc -eq 0 ] && $(SMOKE) exec -T app python - $(SMOKE_PASSWORD) < scripts/smoke.py; rc=$$?; \
	$(SMOKE) down -v >/dev/null 2>&1; rm -f .env.smoke; exit $$rc

hash: ## Print an argon2 hash for ADMIN_PASSWORD_HASH
	@cd backend && uv run python -m app.core.security hash-password

up: ## Server: build and start prod stack (ignores the dev override)
	$(COMPOSE_PROD) up -d --build

logs: ## Server: follow app logs
	$(COMPOSE_PROD) logs -f app

staff: ## Server: manage staff accounts, e.g. make staff ARGS="add lan" (also passwd|disable|enable <user>, list)
	$(COMPOSE_PROD) exec app python -m app.features.auth.staff $(ARGS)
