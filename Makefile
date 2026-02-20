# Baltic Wind HV Control Platform — Makefile
# Universal task runner: make <target>

.PHONY: help install install-backend install-frontend lint lint-backend lint-frontend \
        format test test-backend test-frontend docker-up docker-down docs-serve clean

# Default target
help: ## Show this help message
	@echo "Baltic Wind HV Control Platform"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Installation ───────────────────────────────────────────────

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python backend dependencies
	cd backend && pip install -e ".[dev]"

install-frontend: ## Install Node frontend dependencies
	cd frontend && npm ci

install-docs: ## Install MkDocs dependencies
	pip install -r requirements-docs.txt

install-hooks: ## Install pre-commit hooks
	pip install pre-commit && pre-commit install

# ─── Linting ────────────────────────────────────────────────────

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python code (ruff + mypy)
	cd backend && ruff check app/ tests/
	cd backend && ruff format --check app/ tests/
	cd backend && mypy app/

lint-frontend: ## Lint TypeScript code (tsc + eslint)
	cd frontend && npx tsc --noEmit
	cd frontend && npx eslint src/

# ─── Formatting ─────────────────────────────────────────────────

format: ## Auto-format all code
	cd backend && ruff format app/ tests/
	cd backend && ruff check --fix app/ tests/
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"

# ─── Testing ────────────────────────────────────────────────────

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Python tests with coverage
	cd backend && pytest --cov=app --cov-report=term-missing tests/

test-frontend: ## Run TypeScript tests with coverage
	cd frontend && npx vitest run --coverage

# ─── Docker ─────────────────────────────────────────────────────

docker-up: ## Start all services (postgres, redis, backend, frontend)
	docker compose up -d --build

docker-down: ## Stop all services
	docker compose down

docker-logs: ## Tail logs from all services
	docker compose logs -f

# ─── Documentation ──────────────────────────────────────────────

docs-serve: ## Serve MkDocs locally (http://localhost:8080)
	PYTHONUTF8=1 mkdocs serve -a localhost:8080

docs-build: ## Build MkDocs static site
	PYTHONUTF8=1 mkdocs build

# ─── Cleanup ────────────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/dist backend/dist site/ htmlcov/
