# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Infrastructure services:**
- PostgreSQL / TimescaleDB container - primary application database for ORM models and migrations
  - SDK/Client: `sqlalchemy[asyncio]` + `asyncpg`
  - Auth: `DATABASE_URL`
  - Files: `docker-compose.yml`, `backend/app/config.py`, `backend/app/db.py`, `backend/alembic/versions/`
- Redis 7 container - cache backend and health dependency
  - SDK/Client: `redis.asyncio`
  - Auth: `REDIS_URL`
  - Files: `docker-compose.yml`, `backend/app/core/cache.py`, `backend/app/main.py`
- OPC-UA server endpoint - optional industrial protocol surface exposed by the backend
  - SDK/Client: `asyncua`
  - Auth: no application-level auth settings detected
  - Files: `backend/app/services/p3/opcua_server.py`, `backend/app/routers/p3/opcua.py`, `backend/app/routers/p3/__init__.py`
- GitHub Actions / GitHub Pages - CI execution and docs publishing
  - SDK/Client: GitHub workflow actions in YAML
  - Auth: GitHub Actions provided credentials
  - Files: `.github/workflows/ci.yml`, `.github/workflows/docs.yml`, `mkdocs.yml`

**Industrial protocol and utility interfaces:**
- IEC 61850 GOOSE / MMS / SCL - simulated in-process and exposed through REST-backed training endpoints
  - SDK/Client: internal Python services, no raw network client detected
  - Auth: not applicable
  - Files: `backend/app/services/p3/goose_simulation.py`, `backend/app/services/p3/iec61850_model.py`, `backend/app/services/p3/scl_generator.py`
- PSE SCADA, ICCP, ENTSO-E SFTP reporting - represented as architecture and security models, not live client integrations
  - SDK/Client: not detected
  - Auth: not implemented
  - Files: `backend/app/services/p3/network.py`, `backend/app/services/p3/security.py`

**Weather and external data references:**
- ERA5 / ECMWF HRES - referenced as engineering data sources, but the current code generates synthetic local datasets rather than calling an external API
  - SDK/Client: not detected
  - Auth: not applicable
  - Files: `backend/app/services/p1/data_processing.py`, `backend/app/routers/p1.py`, `backend/app/services/p4/nwp_pipeline.py`

**Outbound SaaS or HTTP APIs:**
- Not detected in runtime code under `backend/app/`
  - `httpx` is declared in `backend/pyproject.toml`, but no current outbound client usage was found during this scan

## Data Storage

**Databases:**
- PostgreSQL 16 delivered through a TimescaleDB container image in `docker-compose.yml`
  - Connection: `DATABASE_URL` in `backend/app/config.py`
  - Client: SQLAlchemy async engine + AsyncPG driver in `backend/app/db.py`
  - Schema management: Alembic in `backend/alembic.ini` and `backend/alembic/versions/`
  - PostgreSQL-specific features: `UUID` and `JSONB` columns in `backend/app/models/programme.py` and `backend/app/models/security.py`
- TimescaleDB is provisioned as the container image, but no migration enabling the extension or creating hypertables was detected in `backend/alembic/versions/`

**File Storage:**
- Local filesystem only for repository source and documentation in `backend/`, `frontend/`, `docs/`, and root-level config files
- No implemented S3, Azure Blob, GCS, or other object storage client was detected
- Security scenario data mentions immutable S3 backups in `backend/app/services/p3/security.py`, but that is model content rather than a wired integration

**Caching:**
- Redis only
  - Service: `redis` container in `docker-compose.yml`
  - Client: `backend/app/core/cache.py`
  - Usage: TTL-based JSON cache decorator and health ping in `backend/app/core/cache.py`, `backend/app/routers/p1.py`, and `backend/app/routers/p4/_pipeline.py`

## Messaging & Protocols

**Industrial messaging:**
- OPC-UA binary endpoint at port 4840 is implemented by `backend/app/services/p3/opcua_server.py`
- GOOSE publish/subscribe behaviour is simulated in `backend/app/services/p3/goose_simulation.py`
- SCL XML generation is implemented in `backend/app/services/p3/scl_generator.py`

**Application messaging:**
- Frontend-to-backend communication is plain HTTP `fetch` through `frontend/src/services/apiClient.ts`
- Long-running forecast work uses HTTP polling, not push messaging, in `frontend/src/services/forecastApi.ts` and `frontend/src/hooks/usePolling.ts`
- No browser WebSocket or EventSource client was detected under `frontend/src/`
- No backend WebSocket or SSE endpoint was detected under `backend/app/`

**Queues and brokers:**
- None detected
- No Kafka, RabbitMQ, MQTT, NATS, or AMQP client/server code was found in the repository

## Authentication & Identity

**Auth Provider:**
- Custom educational RBAC simulation
  - Implementation: role, zone, and permission logic in `backend/app/services/p3/rbac.py`, `backend/app/services/p3/security.py`, and `backend/app/routers/p3/rbac.py`

**Current state:**
- No JWT, OAuth, session store, SSO, or external identity provider is implemented
- No auth secret, token issuer, or user directory settings are defined in `backend/app/config.py`
- Frontend API clients in `frontend/src/services/` do not attach auth headers
- OPC-UA write access is described as production-gated in comments, but the current demo server in `backend/app/services/p3/opcua_server.py` does not wire an auth policy

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Structured stdout logging via `structlog` in `backend/app/core/logging.py`
- Per-request correlation and timing middleware in `backend/app/core/middleware.py`
- Container health checks for database, cache, backend, and frontend in `docker-compose.yml`
- No Sentry, OpenTelemetry, Prometheus, Grafana, Datadog, or ELK integration was detected

## CI/CD & Deployment

**Hosting:**
- Application hosting: local or self-managed containers via `docker-compose.yml`
- Frontend serving: Nginx container from `frontend/Dockerfile` and `frontend/nginx.conf`
- Documentation hosting: GitHub Pages via `.github/workflows/docs.yml`
- No cloud application deployment manifest was detected for AWS, Azure, GCP, Vercel, Netlify, Render, or Fly.io

**CI Pipeline:**
- GitHub Actions CI for backend and frontend lint/test in `.github/workflows/ci.yml`
- Change-based job selection via `dorny/paths-filter` in `.github/workflows/ci.yml`
- Weekly dependency automation through `.github/dependabot.yml`
- Backend container startup runs Alembic migrations before Uvicorn in `backend/entrypoint.sh`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - backend relational database connection in `backend/app/config.py`
- `REDIS_URL` - cache connection in `backend/app/config.py`
- `CORS_ORIGINS` - FastAPI origin allowlist in `backend/app/config.py` and `backend/app/main.py`
- `DEBUG` - backend log level / echo behaviour in `backend/app/config.py` and `backend/app/core/logging.py`
- Frontend runtime env vars: none detected in `frontend/src/`

**Secrets location:**
- Environment files exist at `backend/.env`, `backend/.env.example`, `frontend/.env`, and `frontend/.env.example`
- Local development credentials are also injected through `docker-compose.yml`
- `frontend/.npmrc` exists; contents were not inspected

## Webhooks & Callbacks

**Incoming:**
- None detected
- The backend exposes REST endpoints in `backend/app/routers/` and an OPC-UA binary endpoint in `backend/app/services/p3/opcua_server.py`, but no webhook receiver patterns were found

**Outgoing:**
- None implemented
- No outbound webhook sender, callback client, or general-purpose HTTP integration layer was detected under `backend/app/`

## Internal API Surface

**Frontend -> backend HTTP integration:**
- Wind resource APIs: `frontend/src/services/windResourceApi.ts` and `frontend/src/services/weatherWindowApi.ts` call `/api/v1/wind/*`
- Grid APIs: `frontend/src/services/gridApi.ts`, `frontend/src/services/protectionApi.ts`, `frontend/src/services/powerQualityApi.ts`, `frontend/src/services/marketApi.ts`, `frontend/src/services/bessApi.ts`, and `frontend/src/services/cableDtsApi.ts` call `/api/v1/grid/*`
- SCADA APIs: `frontend/src/services/scadaApi.ts`, `frontend/src/services/securityApi.ts`, `frontend/src/services/networkApi.ts`, `frontend/src/services/soeApi.ts`, `frontend/src/services/bayApi.ts`, and `frontend/src/services/cmsApi.ts` call `/api/v1/scada/*`
- Forecast APIs: `frontend/src/services/forecastApi.ts` calls `/api/v1/forecast/*`
- Commissioning APIs: `frontend/src/services/commissioningApi.ts` calls `/api/v1/commissioning/*`
- Digital twin APIs: `frontend/src/services/digitalTwinApi.ts` calls `/api/v1/digital-twin/*`
- Turbine physics APIs: `frontend/src/services/turbinePhysicsApi.ts` calls `/api/v1/turbine-physics/*`

**Route prefix note:**
- Backend OPC-UA management routes are mounted under `/api/v1/scada/opcua/*` in `backend/app/routers/p3/__init__.py` and `backend/app/routers/p3/opcua.py`
- Frontend OPC-UA client uses `/api/v1/opcua/*` in `frontend/src/services/opcuaApi.ts`

---

*Integration audit: 2026-04-01*
