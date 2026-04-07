# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Modular monolith in a monorepo. The backend is one FastAPI process with domain-sliced routers and services; the frontend is one React SPA that mirrors those same domain slices through pages, stores, services, and components.

**Key Characteristics:**
- `backend/app/main.py` is the single backend composition root. It wires middleware, structured logging, Redis, DB seeding, OPC-UA startup, and every router.
- Domain boundaries follow project phases across the stack: `p1`, `p2`, `p3`, `p4`, and `p5` appear in `backend/app/services/`, `backend/app/routers/`, `frontend/src/components/`, and `frontend/src/store/`.
- Analytical features are mostly service-first and simulation-driven. Persistent workflows are concentrated in `backend/app/models/`, `backend/app/routers/p3/*.py`, and `backend/app/routers/p5/*.py`.
- Documentation and workflow automation are parallel subsystems, not part of app runtime: markdown sources live in `docs/`, CI lives in `.github/workflows/`, and Codex workflow tooling lives in `.codex/get-shit-done/`.

## Layers

**Frontend SPA Layer:**
- Purpose: Route-level UI, control-room layouts, and dashboard composition.
- Location: `frontend/src/`
- Contains: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/*.tsx`, `frontend/src/components/**`, `frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/layout/Sidebar.tsx`
- Depends on: React, React Router, Zustand stores in `frontend/src/store/*.ts`, typed API wrappers in `frontend/src/services/*.ts`
- Used by: Vite entry in `frontend/src/main.tsx`, Vite proxy config in `frontend/vite.config.ts`, frontend container in `docker-compose.yml`

**Frontend State and Transport Layer:**
- Purpose: Keep HTTP access and domain state outside presentational components.
- Location: `frontend/src/store/`, `frontend/src/services/`, `frontend/src/types/`
- Contains: domain stores such as `frontend/src/store/windResourceStore.ts`, `frontend/src/store/gridStore.ts`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/commissioningStore.ts`, and `frontend/src/store/digitalTwinStore.ts`; typed API wrappers such as `frontend/src/services/windResourceApi.ts`, `frontend/src/services/gridApi.ts`, and `frontend/src/services/commissioningApi.ts`; shared fetch helpers in `frontend/src/services/apiClient.ts`
- Depends on: backend route contracts, browser `fetch`, TypeScript domain types in `frontend/src/types/*.ts`
- Used by: route pages in `frontend/src/pages/*.tsx` and shell-level hooks such as `frontend/src/hooks/useFaultSync.ts`

**Backend Composition Layer:**
- Purpose: Assemble the FastAPI app and own process lifecycle.
- Location: `backend/app/main.py`, `backend/app/config.py`, `backend/app/core/*.py`
- Contains: app creation, CORS, request logging middleware, structured logging, exception registration, Redis init/close, DB seed, OPC-UA server start/stop, and `/health`
- Depends on: `backend/app/db.py`, `backend/app/routers/`, `backend/app/services/p3/opcua_server.py`, environment settings in `backend/app/config.py`
- Used by: backend container, local ASGI startup, and health checks in `docker-compose.yml`

**Backend Router and Schema Layer:**
- Purpose: Define stable HTTP boundaries and translate request/response contracts into service calls.
- Location: `backend/app/routers/`, `backend/app/schemas/`
- Contains: phase routers `backend/app/routers/p1.py` and `backend/app/routers/p2.py`; aggregated packages `backend/app/routers/p3/__init__.py`, `backend/app/routers/p4/__init__.py`, and `backend/app/routers/p5/__init__.py`; adjacent domains `backend/app/routers/turbine_physics.py` and `backend/app/routers/digital_twin.py`; Pydantic schema files such as `backend/app/schemas/grid.py`, `backend/app/schemas/scada.py`, and `backend/app/schemas/commissioning.py`
- Depends on: service modules in `backend/app/services/**`, DB session dependency in `backend/app/db.py`, shared exception types in `backend/app/core/exceptions.py`
- Used by: `backend/app/main.py`

**Backend Domain Service Layer:**
- Purpose: Hold domain calculations, state machines, deterministic data generators, and aggregate logic.
- Location: `backend/app/services/`
- Contains: phase service packages `backend/app/services/p1/` through `backend/app/services/p5/`, turbine dynamics in `backend/app/services/turbine_physics/`, and condition monitoring in `backend/app/services/digital_twin/`
- Depends on: numerical and ML libraries from `backend/pyproject.toml`, ORM models when persistence is needed, and Redis cache helpers in `backend/app/core/cache.py`
- Used by: router modules, seed logic in `backend/app/seed.py`, and repository logic in `backend/app/services/p5/programme_repository.py`

**Persistence and Migration Layer:**
- Purpose: Store long-lived reference data, permit workflows, and commissioning aggregates.
- Location: `backend/app/db.py`, `backend/app/models/`, `backend/alembic/`
- Contains: async SQLAlchemy engine/session in `backend/app/db.py`; ORM models such as `backend/app/models/wind_farm.py`, `backend/app/models/ptw.py`, and `backend/app/models/programme.py`; migration entrypoint `backend/alembic/env.py`; revision files in `backend/alembic/versions/*.py`
- Depends on: PostgreSQL/TimescaleDB, SQLAlchemy async, JSONB columns for P5 aggregate snapshots
- Used by: startup seed in `backend/app/seed.py`, P3 stateful routers, and P5 repository-backed routes

**Tooling and Documentation Layer:**
- Purpose: Support developer workflow, CI, and docs publishing without owning application runtime logic.
- Location: `Makefile`, `docker-compose.yml`, `mkdocs.yml`, `docs/`, `.github/workflows/`, `.codex/get-shit-done/`
- Contains: local task runner in `Makefile`, service orchestration in `docker-compose.yml`, documentation config in `mkdocs.yml`, markdown docs in `docs/`, CI definitions in `.github/workflows/ci.yml` and `.github/workflows/docs.yml`, and workflow assets in `.codex/get-shit-done/`
- Depends on: backend/frontend source trees and project documentation
- Used by: local development, CI, docs deployment, and Codex planning workflows

## Data Flow

**Interactive Dashboard Request Flow:**

1. `frontend/src/App.tsx` routes navigation to a page such as `frontend/src/pages/WindResourcePage.tsx`, `frontend/src/pages/HVGridPage.tsx`, or `frontend/src/pages/SCADAPage.tsx`.
2. The page triggers actions in a domain store such as `frontend/src/store/windResourceStore.ts`, `frontend/src/store/gridStore.ts`, or `frontend/src/store/scadaStore.ts`.
3. The store calls typed request functions in `frontend/src/services/*.ts`, all of which go through `frontend/src/services/apiClient.ts`.
4. Vite forwards `/api` to the backend in `frontend/vite.config.ts`.
5. A FastAPI router in `backend/app/routers/*.py` validates input with Pydantic models and calls service functions from `backend/app/services/**`.
6. The service returns JSON-serializable data or schema objects; the store writes them into Zustand state; components under `frontend/src/components/**` render the result.

**Persisted Workflow Flow (P3 and P5):**

1. A stateful route such as `backend/app/routers/p3/permits.py` or `backend/app/routers/p5/switching.py` requests `AsyncSession = Depends(get_session)` from `backend/app/db.py`.
2. The router loads ORM rows or aggregates through models like `backend/app/models/ptw.py` or `backend/app/services/p5/programme_repository.py`.
3. Domain services mutate the current workflow using modules like `backend/app/services/p3/permit_to_work.py` or `backend/app/services/p5/switching_programme.py`.
4. The router commits changes back to PostgreSQL. P3 stores relational lifecycle data; P5 stores aggregate snapshots through JSONB models in `backend/app/models/programme.py`.
5. The frontend refreshes state through `frontend/src/store/scadaStore.ts` or `frontend/src/store/commissioningStore.ts`.

**Simulation-First Analysis Flow:**

1. Many APIs generate deterministic demo inputs instead of reading live field data, for example `backend/app/routers/p1.py`, `backend/app/routers/p2.py`, `backend/app/routers/p3/historian.py`, and `backend/app/routers/digital_twin.py`.
2. Service modules such as `backend/app/services/p1/wake_model.py`, `backend/app/services/p2/load_flow.py`, `backend/app/services/p3/historian.py`, and `backend/app/services/digital_twin/scenario_generator.py` run calculations or synthesize time series.
3. Expensive helpers can be memoized with the Redis-backed `@cached` decorator in `backend/app/core/cache.py`; current direct use appears in `backend/app/routers/p1.py` and `backend/app/routers/p2.py`.
4. The UI consumes these simulation outputs through the same store/service path as persistent data, so rendering code stays stable while backend data sources vary.

**Documentation and Workflow Flow:**

1. Source documentation lives in `docs/` and is organized by shared docs plus language-specific lesson trees.
2. `mkdocs.yml` defines nav and theme for the site generated from `docs/`.
3. `.github/workflows/docs.yml` and local `make docs-build` / `make docs-serve` execute the docs pipeline.
4. `.codex/get-shit-done/` provides workflow templates and references used by planning commands, but it does not participate in app request handling.

**State Management:**
- Frontend state is domain-scoped. Each major module has its own Zustand store, for example `frontend/src/store/windResourceStore.ts`, `frontend/src/store/gridStore.ts`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/forecastStore.ts`, and `frontend/src/store/commissioningStore.ts`.
- Pages keep transient UI state locally, such as tab selection in `frontend/src/pages/HVGridPage.tsx` and fullscreen/detail panel state in `frontend/src/pages/LandingPage.tsx`.
- Backend state is mostly request-scoped for calculations, with durable persistence only where the domain needs it. Some features still use in-memory registries, for example `backend/app/services/p1/farm_comparison.py`.

## Key Abstractions

**Project-Phase Domain Slice:**
- Purpose: Keep the same domain boundary across backend services, routers, frontend pages, frontend components, frontend stores, and frontend types.
- Examples: `backend/app/services/p1/`, `backend/app/routers/p1.py`, `frontend/src/pages/WindResourcePage.tsx`, `frontend/src/components/p1/`, `frontend/src/store/windResourceStore.ts`
- Pattern: Add new code inside the matching phase slice first. Only create a cross-phase module when the concern is truly shared.

**Router Aggregator Package:**
- Purpose: Split a large domain into subrouters without changing its public base prefix.
- Examples: `backend/app/routers/p3/__init__.py`, `backend/app/routers/p4/__init__.py`, `backend/app/routers/p5/__init__.py`
- Pattern: Keep the shared `APIRouter(prefix=..., tags=...)` in the package `__init__.py`, then include specialized sibling routers.

**Typed Frontend Transport Boundary:**
- Purpose: Keep React components unaware of raw `fetch` details and backend URL assembly.
- Examples: `frontend/src/services/gridApi.ts`, `frontend/src/services/windResourceApi.ts`, `frontend/src/services/commissioningApi.ts`, `frontend/src/services/apiClient.ts`
- Pattern: API files map closely to backend routes; stores orchestrate calls; components read state and dispatch store actions.

**Aggregate Repository:**
- Purpose: Persist nested commissioning workflows as complete aggregates rather than a highly normalized relational graph.
- Examples: `backend/app/services/p5/programme_repository.py`, `backend/app/models/programme.py`, `backend/app/routers/p5/switching.py`
- Pattern: Domain dataclasses are serialized into JSONB-backed models, loaded as a full unit, mutated in memory, and flushed back through the repository.

**Synthetic Data Generator:**
- Purpose: Keep dashboards functional when live SCADA, historian, or wind-farm data is unavailable.
- Examples: `backend/app/services/p3/historian.py`, `backend/app/services/p4/scada_generator.py`, `backend/app/services/digital_twin/scenario_generator.py`, `backend/app/services/p1/farm_comparison.py`
- Pattern: The service layer owns deterministic generation; routers expose stable contracts; the frontend does not care whether the source is simulated or persisted.

**Platform Core Service:**
- Purpose: Provide runtime behavior once per process instead of re-implementing it in every domain.
- Examples: `backend/app/core/cache.py`, `backend/app/core/exceptions.py`, `backend/app/core/logging.py`, `backend/app/core/middleware.py`
- Pattern: Initialize from `backend/app/main.py`; import from domain code when caching, logging, or standardized error mapping is needed.

## Entry Points

**Backend HTTP Application:**
- Location: `backend/app/main.py`
- Triggers: ASGI startup, backend container boot, `/health` probes
- Responsibilities: start Redis, seed the DB, start the OPC-UA server, register middleware and exception handlers, include all routers

**Frontend Bootstrap:**
- Location: `frontend/src/main.tsx`
- Triggers: browser load through Vite or nginx
- Responsibilities: create the React root and import global styles from `frontend/src/index.css`

**Frontend Route Map:**
- Location: `frontend/src/App.tsx`
- Triggers: browser navigation
- Responsibilities: define `BrowserRouter`, wrap the tree with `frontend/src/components/common/ErrorBoundary.tsx`, and mount pages inside `frontend/src/components/layout/AppShell.tsx`

**Local Runtime Orchestration:**
- Location: `docker-compose.yml`
- Triggers: `make docker-up` or `docker compose up`
- Responsibilities: run PostgreSQL, Redis, backend, and frontend with health-check ordering

**Migration Entry Point:**
- Location: `backend/alembic/env.py`
- Triggers: Alembic revision and upgrade commands
- Responsibilities: load model metadata from `backend/app/models/__init__.py` and execute async PostgreSQL migrations

**Developer Workflow Entry Point:**
- Location: `Makefile`
- Triggers: `make install`, `make lint`, `make test`, `make docs-serve`, `make docker-up`
- Responsibilities: standardize install, lint, test, docs, and compose commands

**CI and Docs Entry Points:**
- Location: `.github/workflows/ci.yml`, `.github/workflows/docs.yml`, `mkdocs.yml`
- Triggers: GitHub Actions and local MkDocs commands
- Responsibilities: run validation and publish the documentation pipeline

## Error Handling

**Strategy:** Domain-first exception mapping on the backend, store-level API error capture on the frontend, and a top-level React error boundary for render failures.

**Patterns:**
- `backend/app/core/exceptions.py` defines `DomainError`, `NotFoundError`, `ValidationError`, `StateTransitionError`, and `PermissionDeniedError`, and `backend/app/main.py` registers them globally.
- Compute-heavy routers such as `backend/app/routers/p1.py` and `backend/app/routers/p2.py` catch unexpected failures and rethrow domain errors to keep JSON responses consistent.
- Some stateful routers still use direct `HTTPException` for explicit request or lookup failures, for example `backend/app/routers/p3/permits.py` and `backend/app/routers/p3/historian.py`.
- `frontend/src/services/apiClient.ts` throws an `Error` with the backend `detail` payload on non-2xx responses; stores write that message into local `error` state.
- `frontend/src/components/common/ErrorBoundary.tsx` prevents a full white-screen crash when rendering fails inside the SPA.

## Cross-Cutting Concerns

**Logging:** Structured backend logging is configured in `backend/app/core/logging.py`, and request correlation IDs are added in `backend/app/core/middleware.py`. Frontend render-time failures are logged with `console.error` in `frontend/src/components/common/ErrorBoundary.tsx`.

**Validation:** Backend request and response contracts are enforced with Pydantic models in `backend/app/schemas/*.py` plus router-level enum and range checks. Frontend compile-time validation comes from strict TypeScript in `frontend/tsconfig.json` and domain types in `frontend/src/types/*.ts`.

**Authentication:** Not detected as a global JWT or session-auth layer. Current access control is an educational RBAC simulation in `backend/app/services/p3/rbac.py`, surfaced through role selection in `frontend/src/pages/SCADAPage.tsx` and permission-aware permit logic in `backend/app/routers/p3/permits.py`.

**Caching:** Optional Redis-backed memoization is centralized in `backend/app/core/cache.py`. It is used for expensive helper calls, not as a shared source of truth for application state.

---

*Architecture analysis: 2026-04-01*
