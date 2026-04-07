# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```text
[project-root]/
├── backend/                    # FastAPI app, domain services, ORM models, Alembic, pytest suite
│   ├── app/
│   │   ├── core/               # Shared runtime utilities: logging, exceptions, middleware, cache
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── routers/            # HTTP route modules and aggregated subrouters
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Domain logic by phase plus digital twin and turbine physics
│   │   ├── config.py           # Pydantic settings
│   │   ├── db.py               # Async engine, session factory, dependency
│   │   ├── main.py             # FastAPI entrypoint
│   │   └── seed.py             # Reference farm seeding
│   ├── alembic/                # DB migration environment and revisions
│   ├── tests/                  # Backend pytest suite
│   └── pyproject.toml          # Backend dependencies and tooling config
├── frontend/                   # React SPA, Vite config, Vitest suite
│   ├── src/
│   │   ├── components/         # UI grouped by domain and shared UI/layout primitives
│   │   ├── constants/          # Static UI constants and educational content
│   │   ├── hooks/              # Shared React hooks
│   │   ├── lib/                # Small shared UI/library wrappers
│   │   ├── pages/              # Route-level page components
│   │   ├── services/           # Typed API clients
│   │   ├── store/              # Zustand stores by domain
│   │   ├── types/              # TypeScript domain contracts
│   │   └── utils/              # Frontend helpers
│   ├── tests/                  # Frontend component/service/store tests
│   ├── package.json            # Frontend dependencies and scripts
│   ├── vite.config.ts          # Dev server, proxy, and test config
│   └── tsconfig.json           # TypeScript strict-mode config
├── docs/                       # Source markdown for standards, roadmap, lessons, and multilingual docs
├── .github/workflows/          # CI and docs automation
├── .codex/get-shit-done/       # Workflow references, templates, and command assets
├── docker-compose.yml          # Local multi-service stack
├── Makefile                    # Standard developer commands
├── README.md                   # Project overview and quick start
├── AGENTS.md                   # Repo-specific agent instructions
├── CLAUDE.md                   # Alternate agent bootstrap instructions
└── mkdocs.yml                  # Documentation site configuration
```

## Directory Purposes

**`backend/app/`:**
- Purpose: Primary backend source tree.
- Contains: runtime composition, domain routers, schemas, services, models, and startup seed logic
- Key files: `backend/app/main.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/seed.py`

**`backend/app/core/`:**
- Purpose: Shared backend runtime utilities that should not be duplicated inside phase services.
- Contains: `backend/app/core/cache.py`, `backend/app/core/exceptions.py`, `backend/app/core/logging.py`, `backend/app/core/middleware.py`
- Key files: `backend/app/core/cache.py`, `backend/app/core/exceptions.py`

**`backend/app/routers/`:**
- Purpose: HTTP boundary layer for every backend capability.
- Contains: top-level phase routers such as `backend/app/routers/p1.py` and `backend/app/routers/p2.py`, aggregated router packages `backend/app/routers/p3/`, `backend/app/routers/p4/`, `backend/app/routers/p5/`, plus `backend/app/routers/digital_twin.py` and `backend/app/routers/turbine_physics.py`
- Key files: `backend/app/routers/p1.py`, `backend/app/routers/p2.py`, `backend/app/routers/p3/__init__.py`, `backend/app/routers/p5/switching.py`

**`backend/app/services/`:**
- Purpose: Domain logic, simulation engines, state machines, and aggregate repositories.
- Contains: phase packages `backend/app/services/p1/` through `backend/app/services/p5/`, plus `backend/app/services/digital_twin/` and `backend/app/services/turbine_physics/`
- Key files: `backend/app/services/p2/load_flow.py`, `backend/app/services/p3/historian.py`, `backend/app/services/p5/programme_repository.py`, `backend/app/services/digital_twin/scenario_generator.py`

**`backend/app/models/`:**
- Purpose: SQLAlchemy persistence models.
- Contains: wind farm, grid, forecast, SCADA, permit, commissioning, and JSONB-backed programme models
- Key files: `backend/app/models/wind_farm.py`, `backend/app/models/ptw.py`, `backend/app/models/programme.py`, `backend/app/models/__init__.py`

**`backend/app/schemas/`:**
- Purpose: Pydantic request/response contracts shared by routers and services.
- Contains: one schema file per major domain, for example `backend/app/schemas/grid.py`, `backend/app/schemas/scada.py`, `backend/app/schemas/commissioning.py`, `backend/app/schemas/digital_twin.py`
- Key files: `backend/app/schemas/grid.py`, `backend/app/schemas/commissioning.py`

**`backend/alembic/`:**
- Purpose: Database migration source.
- Contains: async Alembic environment and committed revision files
- Key files: `backend/alembic/env.py`, `backend/alembic/versions/1acc76f82174_p1_initial_schema_wind_farm_turbine_.py`, `backend/alembic/versions/d5e6f7a8b9c0_p3b_permit_to_work.py`

**`backend/tests/`:**
- Purpose: Backend verification of service logic and selected router flows.
- Contains: one pytest module per feature or service
- Key files: `backend/tests/test_load_flow.py`, `backend/tests/test_permit_to_work.py`, `backend/tests/test_switching_programme.py`

**`frontend/src/pages/`:**
- Purpose: Route-level feature entry points.
- Contains: page components for overview plus each major module
- Key files: `frontend/src/pages/LandingPage.tsx`, `frontend/src/pages/WindResourcePage.tsx`, `frontend/src/pages/HVGridPage.tsx`, `frontend/src/pages/SCADAPage.tsx`, `frontend/src/pages/CommissioningPage.tsx`, `frontend/src/pages/DigitalTwinPage.tsx`

**`frontend/src/components/`:**
- Purpose: UI implementation split by domain plus shared layout and primitive UI.
- Contains: phase folders `frontend/src/components/p1/` through `frontend/src/components/p5/`, shared folders `frontend/src/components/ui/`, `frontend/src/components/layout/`, and specialized folders like `frontend/src/components/digital-twin/` and `frontend/src/components/landing/`
- Key files: `frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/p2/GridDashboard.tsx`, `frontend/src/components/p3/SCADADashboard.tsx`

**`frontend/src/store/`:**
- Purpose: Per-domain Zustand stores and shared client-side event buses.
- Contains: store files suffixed with `Store.ts` plus `frontend/src/store/faultBus.ts`
- Key files: `frontend/src/store/windResourceStore.ts`, `frontend/src/store/gridStore.ts`, `frontend/src/store/scadaStore.ts`, `frontend/src/store/commissioningStore.ts`, `frontend/src/store/digitalTwinStore.ts`

**`frontend/src/services/`:**
- Purpose: Typed HTTP wrappers that map UI actions to backend routes.
- Contains: `*Api.ts` files plus shared `frontend/src/services/apiClient.ts`
- Key files: `frontend/src/services/apiClient.ts`, `frontend/src/services/windResourceApi.ts`, `frontend/src/services/gridApi.ts`, `frontend/src/services/scadaApi.ts`, `frontend/src/services/commissioningApi.ts`

**`frontend/src/types/`:**
- Purpose: TypeScript domain contracts used by stores, services, and components.
- Contains: one type file per domain
- Key files: `frontend/src/types/windResource.ts`, `frontend/src/types/grid.ts`, `frontend/src/types/scada.ts`, `frontend/src/types/commissioning.ts`

**`frontend/tests/`:**
- Purpose: Frontend verification for components, constants, services, and stores.
- Contains: route-level smoke tests plus domain-organized folders like `frontend/tests/components/`, `frontend/tests/services/`, and `frontend/tests/store/`
- Key files: `frontend/tests/App.test.tsx`, `frontend/tests/components/p3/SCADADashboard.test.tsx`, `frontend/tests/services/commissioningApi.test.ts`, `frontend/tests/store/gridStore.test.ts`

**`docs/`:**
- Purpose: Source documentation, standards, lessons, and multilingual content.
- Contains: base docs such as `docs/SKILL.md` and `docs/Project_Roadmap.md`, lesson content under `docs/lessons/`, and localized content under `docs/en/`, `docs/pl/`, and `docs/tr/`
- Key files: `docs/SKILL.md`, `docs/Project_Roadmap.md`, `docs/Learning_Roadmap.md`

**`.github/workflows/`:**
- Purpose: CI and docs automation.
- Contains: workflow YAML only
- Key files: `.github/workflows/ci.yml`, `.github/workflows/docs.yml`

**`.codex/get-shit-done/`:**
- Purpose: Codex workflow/tooling context. This is planning infrastructure, not app runtime code.
- Contains: command assets, workflow definitions, references, and templates
- Key files: `.codex/get-shit-done/workflows/`, `.codex/get-shit-done/templates/`, `.codex/get-shit-done/references/`

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: backend FastAPI composition root
- `frontend/src/main.tsx`: frontend bootstrap
- `frontend/src/App.tsx`: frontend route map and shell composition
- `docker-compose.yml`: local runtime orchestration
- `Makefile`: developer command entrypoint
- `mkdocs.yml`: docs build entrypoint

**Configuration:**
- `backend/pyproject.toml`: backend dependencies, Ruff, mypy, pytest
- `frontend/package.json`: frontend dependencies and npm scripts
- `frontend/tsconfig.json`: frontend strict TypeScript config
- `frontend/vite.config.ts`: Vite server proxy and Vitest config
- `frontend/eslint.config.js`: frontend lint rules
- `backend/app/config.py`: backend environment settings
- `.pre-commit-config.yaml`: repo-wide pre-commit hooks

**Core Logic:**
- `backend/app/services/p1/`: wind resource and AEP logic
- `backend/app/services/p2/`: grid integration and power-system analysis
- `backend/app/services/p3/`: SCADA, historian, GOOSE, RBAC, and permit logic
- `backend/app/services/p4/`: forecasting and data-quality logic
- `backend/app/services/p5/`: commissioning workflows, LOTO, FAT/SAT, and programme persistence
- `backend/app/services/digital_twin/`: condition monitoring and anomaly scoring
- `backend/app/services/turbine_physics/`: turbine dynamics and control simulation
- `frontend/src/components/landing/`: overview-map UI
- `frontend/src/components/p1/` through `frontend/src/components/p5/`: phase dashboards

**Testing:**
- `backend/tests/`: backend test suite
- `frontend/tests/`: frontend test suite
- `frontend/vite.config.ts`: Vitest setup
- `backend/pyproject.toml`: pytest config

## Naming Conventions

**Files:**
- Backend Python modules use snake_case file names, for example `backend/app/services/p5/programme_repository.py`, `backend/app/services/p2/load_flow.py`, and `backend/app/routers/p2_power_quality.py`.
- Large backend domain entry files keep phase-prefixed names when they are single-file routers, for example `backend/app/routers/p1.py` and `backend/app/routers/p2.py`.
- Frontend pages and components use PascalCase file names, for example `frontend/src/pages/HVGridPage.tsx`, `frontend/src/components/p3/SCADADashboard.tsx`, and `frontend/src/components/layout/Sidebar.tsx`.
- Frontend stores, services, constants, and utility modules use camelCase file names with suffixes, for example `frontend/src/store/gridStore.ts`, `frontend/src/services/gridApi.ts`, `frontend/src/constants/scadaColors.ts`, and `frontend/src/utils/wakeModel.ts`.

**Directories:**
- Backend service directories use phase or feature nouns: `backend/app/services/p1`, `backend/app/services/p2`, `backend/app/services/digital_twin`, `backend/app/services/turbine_physics`.
- Backend router packages use phase folders only when the domain is large enough to split: `backend/app/routers/p3/`, `backend/app/routers/p4/`, `backend/app/routers/p5/`.
- Frontend component directories mirror feature ownership: `frontend/src/components/p1/`, `frontend/src/components/p2/`, `frontend/src/components/landing/`, `frontend/src/components/ui/`.

## Where to Add New Code

**New Backend Feature in an Existing Phase:**
- Primary router: use `backend/app/routers/p3/` or `backend/app/routers/p5/` when the phase already has subrouter packages; otherwise extend `backend/app/routers/p1.py` or `backend/app/routers/p2.py`
- Schemas: add request/response models to the matching file in `backend/app/schemas/` or create a new snake_case schema file when the domain is large
- Services: put domain logic in the matching phase package under `backend/app/services/p1/` through `backend/app/services/p5/`
- Persistence: add or extend ORM models in `backend/app/models/` only when the feature needs durable storage
- Tests: add `backend/tests/test_<feature>.py`

**New Frontend Module or Dashboard Capability:**
- Route page: add a new page in `frontend/src/pages/` only when it deserves a route
- Domain UI: add components inside the matching feature folder, for example `frontend/src/components/p2/` or `frontend/src/components/digital-twin/`
- Store: add or extend a domain store in `frontend/src/store/`
- API wrapper: add request functions in the matching `frontend/src/services/*Api.ts`
- Types: add or extend the matching file in `frontend/src/types/`
- Tests: add component tests in `frontend/tests/components/`, service tests in `frontend/tests/services/`, and store tests in `frontend/tests/store/`

**Utilities and Shared Code:**
- Backend cross-domain runtime helpers belong in `backend/app/core/`, not inside a random phase package
- Frontend generic UI primitives belong in `frontend/src/components/ui/`
- Frontend shell or navigation code belongs in `frontend/src/components/layout/`
- Frontend generic helpers belong in `frontend/src/lib/` or `frontend/src/utils/`

**Docs and Workflow Context:**
- User-facing documentation belongs in `docs/`, not in workflow directories
- CI changes belong in `.github/workflows/`
- Codex workflow assets belong in `.codex/get-shit-done/`

## Special Directories

**`backend/alembic/versions/`:**
- Purpose: committed migration history
- Generated: Yes
- Committed: Yes

**`.github/workflows/`:**
- Purpose: CI and docs automation definitions
- Generated: No
- Committed: Yes

**`.codex/get-shit-done/`:**
- Purpose: workflow tooling context for planning/execution commands
- Generated: No
- Committed: Yes

**`docs/en/`, `docs/pl/`, `docs/tr/`:**
- Purpose: localized documentation trees
- Generated: No
- Committed: Yes

**Source Placement Rules:**
- Put application source only in `backend/app/` and `frontend/src/`.
- Put tests only in `backend/tests/` and `frontend/tests/`.
- Put docs source only in `docs/`.
- Do not place new source code in generated, cache, or build-output directories.

---

*Structure analysis: 2026-04-01*
