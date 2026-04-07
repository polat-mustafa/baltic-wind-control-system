# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- Backend: `pytest`, `pytest-cov`, and `pytest-asyncio` are configured in `backend/pyproject.toml`.
- Frontend: `vitest` with `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom` is configured through `frontend/package.json` and `frontend/vite.config.ts`.
- Config: backend settings live in `backend/pyproject.toml`; frontend test config lives in `frontend/vite.config.ts`; shared browser test setup lives in `frontend/tests/setup.ts`.

**Assertion Library:**
- Backend uses bare `assert`, `pytest.raises`, `pytest.approx`, and `pytest.mark.parametrize`, as seen in `backend/tests/test_load_flow.py`, `backend/tests/test_permit_to_work.py`, and `backend/tests/test_emergency_response.py`.
- Frontend uses Vitest `expect` plus Testing Library queries and `@testing-library/jest-dom`, as seen in `frontend/tests/App.test.tsx`, `frontend/tests/components/p2/GridDashboard.test.tsx`, and `frontend/tests/services/gridApi.test.ts`.

**Run Commands:**
```bash
cd backend && pytest --cov=app --cov-report=term-missing tests/      # Backend tests with coverage
cd frontend && npm run test                                          # Frontend tests
cd frontend && npm run test:watch                                    # Frontend watch mode
cd frontend && npm run test:coverage                                 # Frontend coverage
```

## Test File Organization

**Location:**
- Backend tests live in a dedicated `backend/tests/` tree, not co-located with source. 61 first-party Python test files were detected.
- Frontend tests live in a dedicated `frontend/tests/` tree that mirrors source areas. 73 first-party TypeScript test files were detected.

**Naming:**
- Backend files follow `test_<feature>.py`, for example `backend/tests/test_load_flow.py`, `backend/tests/test_xgboost_model.py`, `backend/tests/test_routers_p2.py`, and `backend/tests/test_tier3_p1.py`.
- Frontend files follow `<Thing>.test.ts` or `<Thing>.test.tsx`, for example `frontend/tests/components/p2/GridDashboard.test.tsx`, `frontend/tests/services/gridApi.test.ts`, and `frontend/tests/store/gridStore.test.ts`.

**Structure:**
```text
backend/tests/
  test_load_flow.py
  test_permit_to_work.py
  test_xgboost_model.py
  test_routers_p2.py
  test_tier2_p1.py
  test_tier3_p1.py

frontend/tests/
  App.test.tsx
  setup.ts
  components/p2/GridDashboard.test.tsx
  services/gridApi.test.ts
  store/gridStore.test.ts
```

## Test Structure

**Suite Organization:**
```python
class TestVoltageCompliance:
    def test_full_load_voltage_range(self):
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert result.v_min_pu >= 0.94
        assert result.v_max_pu <= 1.06
```
Source: `backend/tests/test_load_flow.py`

```typescript
describe("runFullAnalysis", () => {
  it("calls all API endpoints", async () => {
    mockApi.runLoadFlowAll.mockResolvedValue([]);
    await useGridStore.getState().runFullAnalysis();
    expect(useGridStore.getState().analysisRun).toBe(true);
  });
});
```
Source: `frontend/tests/store/gridStore.test.ts`

**Patterns:**
- Backend modules open with a narrative docstring that explains purpose and test strategy, for example `backend/tests/test_load_flow.py`, `backend/tests/test_permit_to_work.py`, and `backend/tests/test_xgboost_model.py`.
- Backend groups related cases inside `class Test...` suites and uses local helper builders like `_small_layout()` and `_advance_to()` to keep repeated setup readable, for example `backend/tests/test_tier2_p1.py` and `backend/tests/test_permit_to_work.py`.
- Frontend groups cases with `describe` and `it`, resets mocks in `beforeEach`, and uses direct render/query assertions with Testing Library, for example `frontend/tests/components/p2/GridDashboard.test.tsx` and `frontend/tests/App.test.tsx`.
- Frontend store tests often mutate and inspect Zustand state directly without mounting UI, for example `frontend/tests/store/gridStore.test.ts`.

## Mocking

**Framework:** `vitest` mocking primitives in frontend; minimal repository-wide mocking in backend.

**Patterns:**
```typescript
vi.mock("../../src/services/gridApi");
vi.stubGlobal("fetch", mockFetch);
vi.mock("react-plotly.js", () => ({ default: () => null }));
```
Sources: `frontend/tests/store/gridStore.test.ts`, `frontend/tests/services/gridApi.test.ts`, `frontend/tests/components/p2/GridDashboard.test.tsx`

- `frontend/tests/setup.ts` provides the shared `window.matchMedia` stub for jsdom.
- Frontend component tests often mock `react-router-dom`, `react-plotly.js`, or store hooks to isolate UI behavior, for example `frontend/tests/components/landing/ExportCableRoute.test.tsx` and `frontend/tests/components/p2/GridDashboard.test.tsx`.
- Backend tests usually do not mock Pandapower, XGBoost, or state-machine logic. They run real computations on small synthetic inputs or reduced layouts, for example `backend/tests/test_load_flow.py`, `backend/tests/test_xgboost_model.py`, and `backend/tests/test_tier2_p1.py`.
- Backend API smoke tests instantiate `TestClient(app)` at module scope and call real endpoints, for example `backend/tests/test_routers_p2.py`, `backend/tests/test_health.py`, `backend/tests/test_digital_twin.py`, and `backend/tests/test_turbine_physics.py`.

**What to Mock:**
- Frontend browser-only globals and heavyweight renderers such as `fetch`, `matchMedia`, `react-plotly.js`, and sometimes router or store boundaries.
- Backend only mock at the boundaries when state reset is easier than full orchestration; the dominant pattern is to use real deterministic helpers instead.

**What NOT to Mock:**
- Do not mock backend physics/state-machine logic if the function can run quickly on a small fixture. Existing tests directly call `run_load_flow`, `apply_transition`, `train_xgboost`, `run_dynamic_flow_simulation`, and `trigger_emergency`.
- Do not over-mock frontend Zustand stores when the store itself is the subject under test. `frontend/tests/store/*.test.ts` exercises actual store actions and state transitions.

## Fixtures and Factories

**Test Data:**
```python
@pytest.fixture(scope="module")
def scada_dataset():
    return generate_scada_dataset(SMALL_SCADA_CONFIG)

def _small_layout():
    x = np.array([0.0, 1200.0, 2400.0, 3600.0], dtype=np.float64)
    y = np.array([0.0, 0.0, 0.0, 0.0], dtype=np.float64)
    return x, y
```
Sources: `backend/tests/test_xgboost_model.py`, `backend/tests/test_tier2_p1.py`

**Location:**
- Backend fixtures are local to each test module, for example `backend/tests/test_xgboost_model.py`, `backend/tests/test_dynamic_compliance.py`, and `backend/tests/test_emergency_response.py`.
- Frontend commonly uses inline object literals and explicit reset helpers, for example `resetStore()` in `frontend/tests/store/gridStore.test.ts`.
- Global frontend test setup lives only in `frontend/tests/setup.ts`.
- No shared `backend/tests/conftest.py` was detected.

## Coverage

**Requirements:** None enforced. Coverage artifacts are generated, but no minimum threshold is declared in `backend/pyproject.toml`, `frontend/vite.config.ts`, or `.github/workflows/ci.yml`.

**View Coverage:**
```bash
cd backend && pytest --cov=app --cov-report=xml --cov-report=term-missing tests/
cd frontend && npm run test:coverage
```

## Test Types

**Unit Tests:**
- Backend unit tests dominate the suite. They target service functions, dataclasses, enums, and calculations directly, for example `backend/tests/test_load_flow.py`, `backend/tests/test_permit_to_work.py`, `backend/tests/test_emergency_response.py`, and `backend/tests/test_xgboost_model.py`.
- These tests favor domain-specific invariants, numeric ranges, monotonicity, and exact lifecycle rules over snapshots or generic smoke checks.

**Integration Tests:**
- Backend integration and smoke tests exist for API routes via `fastapi.testclient.TestClient`, for example `backend/tests/test_routers_p2.py`, `backend/tests/test_health.py`, `backend/tests/test_digital_twin.py`, and `backend/tests/test_turbine_physics.py`.
- Frontend integration-ish tests exist for Zustand stores and service modules, for example `frontend/tests/store/gridStore.test.ts` and `frontend/tests/services/gridApi.test.ts`.

**Component Tests:**
- Frontend component coverage is broad across feature dashboards, panels, and landing-page widgets, for example `frontend/tests/components/p1/*.test.tsx`, `frontend/tests/components/p2/*.test.tsx`, `frontend/tests/components/p3/*.test.tsx`, and `frontend/tests/components/p5/*.test.tsx`.
- Most assertions are render/query based, with some interaction checks such as `fireEvent.click` in `frontend/tests/components/landing/LayerControlPanel.test.tsx`.

**E2E Tests:**
- Not used. No Playwright or Cypress dependency or config was detected in the first-party repo areas reviewed.

## Common Patterns

**Async Testing:**
```typescript
await useGridStore.getState().fetchNetworkSpec();
expect(useGridStore.getState().networkSpec).toEqual(mockSpec);
```
Source: `frontend/tests/store/gridStore.test.ts`

- Backend `pytest-asyncio` is configured in `backend/pyproject.toml`, but current first-party tests are mostly synchronous. Async FastAPI code is usually exercised through `TestClient` rather than `@pytest.mark.asyncio`.

**Error Testing:**
```python
with pytest.raises(InvalidStateTransitionError):
    apply_transition(permit, PermitStatus.APPROVED, "user1", RoleLevel.ADMIN)
```
Source: `backend/tests/test_permit_to_work.py`

```typescript
await expect(api.getNetworkSpec()).rejects.toThrow("Grid not found");
```
Source: `frontend/tests/services/gridApi.test.ts`

**Physics-oriented assertions:**
- Use `pytest.approx`, inequality bands, and invariants rather than exact floating-point equality in backend scientific tests, for example `backend/tests/test_load_flow.py`, `backend/tests/test_tier2_p1.py`, and `backend/tests/test_tier3_p1.py`.
- Use literal domain constants and deterministic sample values in frontend constant and service tests, for example `frontend/tests/constants/scadaColors.test.ts` and `frontend/tests/services/gridApi.test.ts`.

## CI and Verification

- `.github/workflows/ci.yml` uses path filtering to avoid running irrelevant jobs and uploads backend/frontend coverage artifacts on pull requests.
- `Makefile` mirrors the expected test commands for both apps.
- Local verification on 2026-04-01 confirmed:
```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run test -- --run
```
- The frontend verification passed locally with 72 test files and 347 tests.
- Local backend verification did not run in the active shell because the current Python interpreter lacked `pytest`; the repository expects Python 3.13 plus `backend` dev dependencies installed from `backend/pyproject.toml`.

## Notable Gaps

- No shared `backend/tests/conftest.py` exists. Fixtures and builders are repeated per module, which weakens reuse across the 61 backend test files.
- No coverage thresholds are enforced for either backend or frontend.
- Backend has only 8 tests marked `slow`, but there is no richer marker taxonomy for integration, API, ML, or smoke-only segregation.
- Frontend component tests are numerous, but many are shallow render-and-text assertions. End-to-end user flows, real routing flows, and browser-integration scenarios are lightly covered.
- Frontend charting and browser APIs are often mocked, so real Plotly rendering behavior is not directly validated.
- No browser E2E suite exists for route navigation, cross-page workflows, or full-stack user journeys.
- Backend async code paths are mostly covered indirectly through `TestClient` rather than explicit async test functions.

---

*Testing analysis: 2026-04-01*
