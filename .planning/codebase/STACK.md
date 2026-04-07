# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- Python 3.13+ - backend API, persistence, engineering computation, and ML code in `backend/app/`; version floor in `backend/pyproject.toml`, runtime image in `backend/Dockerfile`, CI in `.github/workflows/ci.yml`
- TypeScript 6 + TSX - frontend SPA, API clients, state stores, and tests in `frontend/src/` and `frontend/tests/`; configured in `frontend/package.json` and `frontend/tsconfig.json`

**Secondary:**
- SQL (PostgreSQL dialect) - Alembic migrations and PostgreSQL-specific ORM types in `backend/alembic/versions/`, `backend/app/models/programme.py`, and `backend/app/models/security.py`
- YAML - infrastructure, CI, dependency automation, and docs config in `docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/docs.yml`, `.github/dependabot.yml`, and `mkdocs.yml`
- JavaScript (ES modules) - frontend lint config in `frontend/eslint.config.js`
- CSS - application styling in `frontend/src/index.css` with Tailwind Vite integration from `frontend/vite.config.ts`
- Shell - backend container startup in `backend/entrypoint.sh`

## Runtime

**Environment:**
- Backend runtime: CPython 3.13 in `backend/pyproject.toml`, `backend/Dockerfile`, and `.github/workflows/ci.yml`
- Frontend build runtime: Node.js in `frontend/Dockerfile`; CI pins Node 22 in `.github/workflows/ci.yml`
- Frontend browser runtime: React SPA bootstrapped from `frontend/src/main.tsx` and `frontend/src/App.tsx`
- Web server runtime: Nginx serves the built SPA and proxies `/api` in `frontend/Dockerfile` and `frontend/nginx.conf`
- Docs runtime: MkDocs runs on Python 3.13 in `.github/workflows/docs.yml`

**Package Manager:**
- Python: `pip` editable install from `backend/pyproject.toml`
- Python lockfile: missing for `backend/`
- Node: `npm` from `frontend/package.json`
- Node lockfile: present as `frontend/package-lock.json`
- Docs dependencies: `pip -r requirements-docs.txt`

## Frameworks

**Core:**
- FastAPI 0.115+ - REST backend, lifespan management, health checks, and router composition in `backend/app/main.py` and `backend/app/routers/`
- Pydantic v2 + pydantic-settings - settings and request/response schemas in `backend/app/config.py` and `backend/app/schemas/`
- SQLAlchemy 2 async - async ORM and session management in `backend/app/db.py` and `backend/app/models/`
- Alembic - schema migrations in `backend/alembic.ini` and `backend/alembic/versions/`
- React 19 - frontend application shell and page routing in `frontend/src/App.tsx`
- React Router 7 - client-side routing in `frontend/src/App.tsx`
- Zustand - frontend state stores in `frontend/src/store/`
- Tailwind CSS v4 - styling pipeline through `@tailwindcss/vite` in `frontend/vite.config.ts`

**Testing:**
- pytest 8 + pytest-asyncio + pytest-cov - backend test runner and coverage in `backend/pyproject.toml` and `backend/tests/`
- Vitest 4 + Testing Library + jsdom - frontend tests configured in `frontend/package.json`, `frontend/vite.config.ts`, and `frontend/tests/`

**Build/Dev:**
- Vite 8 + `@vitejs/plugin-react` - frontend dev server and production bundling in `frontend/vite.config.ts`
- Nginx - production SPA serving and reverse proxy in `frontend/nginx.conf`
- Docker Compose - local multi-service orchestration in `docker-compose.yml`
- MkDocs Material - documentation site generation in `mkdocs.yml` and `requirements-docs.txt`
- GitHub Actions - CI and docs deployment in `.github/workflows/ci.yml` and `.github/workflows/docs.yml`

## Key Dependencies

**Critical:**
- `py-wake` - wake model construction and PyWake integration in `backend/app/services/p1/wake_model.py`
- `pandapower` - load flow and grid model execution in `backend/app/services/p2/load_flow.py` and `backend/app/services/p2/network_model.py`
- `andes` - dynamic network and compliance modelling in `backend/app/services/p2/andes_network.py`
- `xgboost` - quantile regression forecasting in `backend/app/services/p4/xgboost_model.py`
- `torch` - LSTM and TFT forecasting models in `backend/app/services/p4/lstm_model.py` and `backend/app/services/p4/tft_model.py`
- `shap` - XGBoost feature explainability in `backend/app/services/p4/xgboost_model.py` and `backend/app/routers/p4/models.py`
- `numpy` and `scipy` - numerical work across engineering and forecasting services such as `backend/app/services/p1/data_processing.py` and `backend/app/services/p4/scada_generator.py`
- `plotly.js-dist-min` + `react-plotly.js` - charting through the Plotly shim in `frontend/src/lib/Plot.tsx`
- `leaflet` + `react-leaflet` - map-based UI in `frontend/src/pages/LandingPage.tsx` and `frontend/src/components/landing/LeafletWindFarmMap.tsx`

**Infrastructure:**
- `asyncpg` - PostgreSQL driver behind SQLAlchemy async in `backend/app/db.py`
- `redis` - async cache client in `backend/app/core/cache.py`
- `asyncua` - optional OPC-UA server support in `backend/app/services/p3/opcua_server.py`
- `structlog` - structured logging in `backend/app/core/logging.py` and `backend/app/core/middleware.py`
- `@radix-ui/react-*` - frontend UI primitives declared in `frontend/package.json`

**Declared but not confirmed in runtime imports during this scan:**
- `httpx` is declared in `backend/pyproject.toml`, but no outbound runtime usage was detected under `backend/app/`
- `xarray` is declared in `backend/pyproject.toml`, but no current import was detected under `backend/app/`

## Configuration

**Environment:**
- Backend settings are loaded through `backend/app/config.py` using Pydantic Settings with `.env` support
- Runtime variables used directly by code are `DATABASE_URL`, `REDIS_URL`, and `CORS_ORIGINS` in `backend/app/config.py`
- Backend startup depends on DB and Redis connectivity in `backend/app/main.py`
- `.env` files are present in `backend/.env`, `backend/.env.example`, `frontend/.env`, and `frontend/.env.example`
- Frontend code does not currently read `import.meta.env`; API base paths are hard-coded to `/api` in `frontend/src/services/`

**Build:**
- Backend packaging, linting, typing, and test config live in `backend/pyproject.toml`
- Backend DB migration config lives in `backend/alembic.ini` and `backend/alembic/versions/`
- Backend container startup runs Alembic before Uvicorn in `backend/entrypoint.sh`
- Frontend build, test, and lint commands live in `frontend/package.json`
- Frontend dev/proxy/test config lives in `frontend/vite.config.ts`
- Frontend lint config lives in `frontend/eslint.config.js`
- Frontend production serving config lives in `frontend/Dockerfile` and `frontend/nginx.conf`
- Repo task shortcuts live in `Makefile`
- Docs build config lives in `mkdocs.yml` and `requirements-docs.txt`

## Platform Requirements

**Development:**
- Python 3.13+ for `backend/` per `backend/pyproject.toml`
- Node.js 22+ for CI parity with `.github/workflows/ci.yml`
- Docker and Docker Compose for the local stack in `docker-compose.yml`
- A reachable PostgreSQL-compatible `DATABASE_URL` and Redis `REDIS_URL` for full backend startup in `backend/app/config.py`
- Frontend development expects backend HTTP access through Vite proxy `/api -> http://localhost:8000` in `frontend/vite.config.ts`

**Production:**
- Container-oriented deployment with `postgres`, `redis`, `backend`, and `frontend` services defined in `docker-compose.yml`
- Backend is served by Uvicorn on port 8000 via `backend/entrypoint.sh`
- Frontend is served by Nginx on port 3000 via `frontend/nginx.conf`
- Documentation deploy target is GitHub Pages from `.github/workflows/docs.yml`
- No cloud-specific runtime target such as Kubernetes, ECS, Fly.io, or Vercel is detected in the repository

---

*Stack analysis: 2026-04-01*
