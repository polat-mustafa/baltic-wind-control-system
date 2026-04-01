# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- Backend Python modules use snake_case and mirror the domain/layer structure, for example `backend/app/services/p2/load_flow.py`, `backend/app/routers/p3/permits.py`, `backend/app/schemas/grid.py`, and `backend/app/models/grid.py`.
- Frontend React components and pages use PascalCase filenames, for example `frontend/src/components/p2/GridDashboard.tsx`, `frontend/src/pages/HVGridPage.tsx`, and `frontend/src/components/common/ErrorBoundary.tsx`.
- Frontend stores, hooks, services, constants, utils, and type modules use camelCase filenames, for example `frontend/src/store/gridStore.ts`, `frontend/src/hooks/usePolling.ts`, `frontend/src/services/apiClient.ts`, `frontend/src/constants/scadaColors.ts`, and `frontend/src/types/grid.ts`.
- Tests follow platform-specific naming: `backend/tests/test_load_flow.py`, `backend/tests/test_permit_to_work.py`, `frontend/tests/components/p2/GridDashboard.test.tsx`, and `frontend/tests/store/gridStore.test.ts`.

**Functions:**
- Python functions use snake_case verbs with domain intent and unit suffixes where useful, for example `run_load_flow`, `auto_statcom_dispatch`, `fault_duration_s`, and `grid_ssc_mva` in `backend/app/services/p2/load_flow.py`.
- FastAPI handlers are `async def` and are named for the route action, for example `load_flow_scenario`, `dynamic_compliance`, and `ppc_status` in `backend/app/routers/p2.py`.
- Frontend components are mostly `export default function ComponentName()` and hooks are prefixed `use`, for example `frontend/src/components/p2/GridDashboard.tsx` and `frontend/src/hooks/usePolling.ts`.
- Store actions use imperative camelCase names such as `fetchNetworkSpec`, `runFullAnalysis`, and `clearError` in `frontend/src/store/gridStore.ts`.

**Variables:**
- Backend variables encode engineering meaning and units, for example `target_vm_pu`, `export_length_km`, `fault_impedance_pu`, and `generation_fraction` in `backend/app/routers/p2.py` and `backend/app/services/p2/load_flow.py`.
- Frontend UI state uses camelCase, for example `analysisRun`, `converterScenario`, and `isLoading` in `frontend/src/store/gridStore.ts` and `frontend/src/hooks/usePolling.ts`.
- API-facing TypeScript types intentionally keep snake_case fields to match backend JSON directly, for example `total_capacity_mw`, `v_min_pu`, and `statcom_rating_mvar` in `frontend/src/types/grid.ts`.

**Types:**
- Backend domain types use PascalCase for dataclasses, enums, ORM models, and Pydantic models, for example `ScenarioConfig`, `PermitRecord`, `EmergencyProcedure`, and `LoadFlowResponse`.
- Frontend interfaces and type aliases use PascalCase and component prop types generally end in `Props`, for example `ButtonProps` in `frontend/src/components/ui/Button.tsx` and `LeafletWindFarmMapProps` in `frontend/src/components/landing/LeafletWindFarmMap.tsx`.
- Finite state sets are encoded as `StrEnum` in backend modules such as `backend/app/schemas/grid.py` and `backend/app/services/p3/permit_to_work.py`, and as union literals or interfaces in `frontend/src/types/*.ts`.

## Code Style

**Formatting:**
- `.editorconfig` is the shared whitespace baseline for the repository. Use UTF-8, LF line endings, trailing whitespace trimming, and final newlines everywhere.
- Use 4 spaces in Python and generic files, and 2 spaces in `*.ts`, `*.tsx`, `*.json`, `*.yml`, `*.yaml`, `*.css`, and `*.html`, per `.editorconfig`.
- Backend formatting is owned by Ruff in `backend/pyproject.toml` with `line-length = 100`.
- Frontend has no committed Prettier config. Formatting is primarily driven by ESLint, editor settings, and existing file style in `frontend/src/`.

**Linting:**
- Backend linting is `ruff check app/ tests/` plus `ruff format --check app/ tests/`, defined in `backend/pyproject.toml`, duplicated in `Makefile`, and enforced in `.github/workflows/ci.yml`.
- Ruff rules are broad (`E`, `W`, `F`, `I`, `N`, `UP`, `B`, `SIM`, `RUF`) and local suppressions are explicit, for example `# noqa: E402` for delayed imports in `backend/app/main.py` and `backend/app/routers/p2.py`.
- Backend type checking is strict mypy with the Pydantic plugin from `backend/pyproject.toml`.
- Frontend linting is `eslint src/` using `typescript-eslint`, `eslint-plugin-react-compiler`, and `eslint-plugin-react-refresh` from `frontend/eslint.config.js`.
- Frontend unused args should be prefixed with `_` to satisfy `@typescript-eslint/no-unused-vars`, for example `_id` in `frontend/src/components/landing/LeafletWindFarmMap.tsx`.

**Type-check and workflow gates:**
- Frontend type checking is separate from linting via `npm run typecheck` (`tsc --noEmit`) in `frontend/package.json`.
- CI in `.github/workflows/ci.yml` runs change-filtered jobs for backend lint, backend tests, frontend type check plus lint, and frontend tests.
- Pre-commit in `.pre-commit-config.yaml` runs hygiene hooks, Ruff, mypy for `backend/`, and ESLint for `frontend/src/`.

**Observed local status on 2026-04-01:**
- `frontend/package.json` quality commands are real and currently clean: `npm run typecheck`, `npm run lint`, and `npm run test -- --run` passed locally.
- Backend quality commands are configured in `backend/pyproject.toml` and CI, but the active shell did not have backend dev dependencies installed. `python -m pytest tests -q` failed because `pytest` was missing from the current interpreter.

## Import Organization

**Order:**
1. Backend files commonly start with a module docstring, then `from __future__ import annotations`, then stdlib imports, third-party imports, and finally first-party `app...` imports, for example `backend/app/main.py` and `backend/app/services/p4/xgboost_model.py`.
2. Frontend files import external packages first, then local relative modules, for example `frontend/src/App.tsx`, `frontend/src/components/ui/Button.tsx`, and `frontend/src/store/gridStore.ts`.
3. TypeScript type-only imports are written with `type`, for example `import { forwardRef, type ButtonHTMLAttributes } from "react";` in `frontend/src/components/ui/Button.tsx`.

**Path Aliases:**
- No general frontend or backend path alias scheme is configured. Imports are relative paths throughout `frontend/src/` and `backend/app/`.
- `frontend/vite.config.ts` defines only a package alias for Plotly resolution: `"plotly.js/dist/plotly": "plotly.js-dist-min"`.

**Pattern example:**
```python
from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.config import settings
from app.core.logging import configure_logging
```
Source: `backend/app/main.py`

## Validation

**Patterns:**
- Prefer declarative Pydantic constraints with `Field(...)` and enums for backend request validation, as in `backend/app/routers/p2.py` and `backend/app/schemas/grid.py`.
- Use `model_config = {"from_attributes": True}` when response models need ORM/domain-object compatibility, for example `backend/app/schemas/grid.py`.
- Frontend compile-time contracts live in `frontend/src/types/*.ts`, and service modules are written against those types rather than duplicating runtime schema checks.

**Pattern example:**
```python
class FRTRequest(BaseModel):
    fault_impedance_pu: float = Field(0.05, ge=0.001, le=1.0)
    generation_fraction: float = Field(1.0, ge=0.0, le=1.0)
```
Source: `backend/app/routers/p2.py`

**Not detected:**
- No dominant custom-validator pattern under `backend/app/`. A repository search did not find active `@field_validator` or `@model_validator` usage in first-party backend code.
- No frontend runtime schema library such as Zod, io-ts, or Yup is declared in `frontend/package.json`.

## Error Handling

**Patterns:**
- Preferred backend pattern is to raise domain-specific exceptions from `backend/app/core/exceptions.py` and let global handlers translate them to JSON responses.
- Router handlers generally catch broad failures and wrap them in `DomainError`, for example `backend/app/routers/p2.py`.
- Frontend service modules funnel HTTP errors through `frontend/src/services/apiClient.ts`, which throws a plain `Error`; stores and hooks normalize the message with `err instanceof Error ? err.message : String(err)`.
- Frontend has a top-level error boundary in `frontend/src/components/common/ErrorBoundary.tsx`.

**Pattern example:**
```python
try:
    return run_all_scenarios(auto_dispatch=True)
except DomainError:
    raise
except Exception as e:
    raise DomainError(f"Load flow analysis failed: {e}") from e
```
Source: `backend/app/routers/p2.py`

**Frontend pattern example:**
```typescript
if (!res.ok) {
  const body = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(body.detail ?? `HTTP ${res.status}`);
}
```
Source: `frontend/src/services/apiClient.ts`

**Notable divergence:**
- Error handling is mixed in backend routers. `backend/app/routers/p2.py` follows the `DomainError` pattern, but many `backend/app/routers/p3/*.py` modules still import and raise `HTTPException` directly, including `backend/app/routers/p3/alarms.py`, `backend/app/routers/p3/cms.py`, `backend/app/routers/p3/devices.py`, and `backend/app/routers/p3/permits.py`.

## Logging

**Framework:** structlog plus stdlib logging in backend; plain console in frontend.

**Patterns:**
- `backend/app/core/logging.py` configures structlog once at startup and formats stdlib `logging.getLogger(__name__)` output.
- `backend/app/core/middleware.py` binds `X-Request-ID` into request context and logs method, path, status, and duration.
- Backend services still mostly use stdlib loggers, for example `backend/app/services/p2/dynamic_compliance.py` and `backend/app/services/p4/model_evaluation.py`.
- Frontend has no central telemetry client. The only explicit global fallback found is `console.error` in `frontend/src/components/common/ErrorBoundary.tsx`.

## Comments

**When to Comment:**
- Backend public modules commonly start with long teaching-oriented docstrings covering physics, standards, maths, and references, for example `backend/app/services/p2/load_flow.py`, `backend/app/services/p4/xgboost_model.py`, and `backend/app/services/p3/permit_to_work.py`.
- Frontend files use block comments to explain layout, API contracts, and store data flow, for example `frontend/src/App.tsx`, `frontend/src/services/apiClient.ts`, and `frontend/src/store/gridStore.ts`.
- Inline comments are mostly section separators or domain clarifications, not narration of obvious code.

**JSDoc/TSDoc:**
- JSDoc-style file headers are common in `frontend/src/`.
- NumPy-style docstrings are common in backend service modules and public helpers.

## Function Design

**Size:** Prefer small to medium helpers around one calculation or transformation, with private helpers prefixed `_`, for example `_apply_n_minus_1`, `_extract_bus_results`, and `_train_quantile_model`.

**Parameters:** Encode units and state in names, especially in backend domain services, for example `freq_step_hz`, `fault_duration_s`, `grid_ssc_mva`, and `target_vm_pu`.

**Return Values:**
- Backend services return dataclasses or Pydantic response models rather than untyped dicts where possible, for example `LoadFlowResponse`, `TransitionResult`, and `ForecastResult`.
- Frontend stores expose async actions returning `Promise<void>` and keep actual data in Zustand state, for example `frontend/src/store/gridStore.ts`.
- Guard clauses returning `null` are common in data-dependent React components, for example `frontend/src/components/p2/GridDashboard.tsx`.

## Module Design

**Exports:**
- Use default exports for most pages and components, for example `frontend/src/pages/HVGridPage.tsx` and `frontend/src/components/p2/GridDashboard.tsx`.
- Use named exports for stores, helpers, service functions, and constants, for example `useGridStore` in `frontend/src/store/gridStore.ts`, `request` in `frontend/src/services/apiClient.ts`, and `SCADA_COLORS` in `frontend/src/constants/scadaColors.ts`.

**Barrel Files:**
- Barrel files are rare. `frontend/src/components/ui/index.ts` is the main example.
- Backend relies on regular `__init__.py` package modules rather than large re-export barrels.

## Notable Gaps

- `Makefile` still calls `npx prettier --write "src/**/*.{ts,tsx,css}"`, but `frontend/package.json` does not declare Prettier and no `.prettierrc` is present. Treat Prettier as not currently enforced.
- `.pre-commit-config.yaml` labels the frontend block as `ESLint + Prettier`, but the configured hook is only ESLint.
- Backend local quality enforcement depends on a prepared Python 3.13 dev environment. The active shell exposed Python 3.14 without `pytest`, so CI is the more reliable source of backend quality enforcement unless a local env is bootstrapped first.
- Frontend typing is generally strict, but there are targeted escapes around Plotly and chart-heavy modules: `frontend/src/lib/Plot.tsx`, `frontend/src/constants/plotlyDefaults.ts`, `frontend/src/components/p1/AEPCascadePanel.tsx`, `frontend/src/components/p1/AvailabilityHeatmap.tsx`, and `frontend/src/components/p3/FleetHealthPanel.tsx`.
- Backend style is not fully unified around `DomainError` yet because several P3 routers still use `HTTPException`.

---

*Convention analysis: 2026-04-01*
