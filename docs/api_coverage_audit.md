# API Coverage Audit — Baltic Wind 510 MW Simulation

**Audit date:** 2026-04-21
**Branch:** `v236-nacelle-overhaul`

This document maps every backend endpoint that previously had **no frontend
caller** to the UI route that now exposes it. The audit was triggered by the
"every line of code must be explainable" learning goal — orphaned endpoints
contradict that contract.

After this round, every previously-orphaned endpoint listed below is reachable
from the SPA. Run a fresh audit with:

```bash
# All backend endpoints
grep -rE "@router\.(get|post|put|delete)" backend/app/routers
# All frontend API callers
grep -r "/api/v1/" frontend/src
```

---

## Group A — P2 Grid Advanced Analysis (8 endpoints)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/dynamic-compliance` | POST | `/hv-grid` → **Advanced** tab | `AdvancedAnalysisTab` |
| `/api/v1/grid/frequency-response` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/sso-analysis` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/andes-network` | GET | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/opf` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/scopf` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/dc-power-flow` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |
| `/api/v1/grid/dc-contingency-screening` | POST | `/hv-grid` → Advanced | `AdvancedAnalysisTab` |

Service module: `frontend/src/services/gridAdvancedApi.ts`
Generic UI primitive: `frontend/src/components/p2/EndpointRunnerCard.tsx`

## Group A2 — P2 Grid Planning & Sector Coupling (10 endpoints)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/economic-dispatch` | POST | `/hv-grid` → **Planning & P2X** | `PlanningCouplingTab` |
| `/api/v1/grid/bess-dispatch` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/ac-dc-comparison` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/capacity-expansion` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/pathway-planning` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/sector-coupling` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/electrolyzer` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/seasonal-storage` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/flexible-demand` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |
| `/api/v1/grid/multi-energy-carrier` | POST | `/hv-grid` → Planning & P2X | `PlanningCouplingTab` |

## Group B — P2 Market Imbalance (1 endpoint)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/market/imbalance` | POST | `/hv-grid` → **Market** tab | `ImbalanceSettlementPanel` |

Service: extension of `frontend/src/services/marketApi.ts` (`runImbalanceSettlement`).

## Group C — P3 SCADA SCL Generator (1 endpoint)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/scada/scl-generate` | POST | `/scada` → **SCL Gen** tab | `SCLGeneratorPanel` |

Service: `frontend/src/services/sclApi.ts`

> **Note:** The original plan estimated 15 unused P3 endpoints, but a
> closer audit found that historian (3), RBAC (3), permits (5) and network
> (3) are already wired through `scadaApi.ts` / `networkApi.ts` and consumed
> by existing panels (`HistorianPanel`, `RBACPanel`, `PermitWorkflowPanel`,
> `NetworkDashboard`). Only `/scl-generate` was genuinely orphaned.

## Group D — P1 Research Lab (8 endpoints)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/wind/helix-control` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/dynamic-flow` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/cfd-simulation` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/simultaneous-optimization` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/adjoint-sensitivities` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/two-stage-stochastic` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/mga` | POST | `/research-lab` | `ResearchLab` |
| `/api/v1/wind/gaussian-flowers-aep` | POST | `/research-lab` | `ResearchLab` |

Service: `frontend/src/services/p1ResearchApi.ts`

## Group E — Live nacelle subsystems (4 endpoints, partial)

The 3D viewer (`/` landing → turbine drill-down) now polls these every 2 s
while a viewer is mounted, replacing the previous closed-form temperature/
pressure formulas with deterministic backend physics.

| Endpoint | Method | UI consumer |
|---|---|---|
| `/api/v1/turbine-sim/nacelle/subsystems` | GET | `nacelleSubsystemsStore` (polling) — drives `ThermalOverlay`, `HPUPressureGauge`, `OilFlowLoop` |
| `/api/v1/turbine-sim/nacelle/hpu` | GET | `nacelleSubsystemsApi.getHPU` (typed wrapper, on-demand) |
| `/api/v1/turbine-sim/nacelle/cooling` | GET | `nacelleSubsystemsApi.getCooling` |
| `/api/v1/turbine-sim/nacelle/safety` | GET | `nacelleSubsystemsApi.getSafety` |

Files:
- `frontend/src/services/nacelleSubsystemsApi.ts`
- `frontend/src/store/nacelleSubsystemsStore.ts`
- `frontend/src/components/landing/turbine3d/scene/ThermalOverlay.tsx`
- `frontend/src/components/landing/turbine3d/scene/NacelleInteriorDetail.tsx`

---

## Summary

| Group | Endpoints | Status |
|---|---:|---|
| A — P2 Grid Advanced | 8 | ✅ wired |
| A2 — P2 Grid Planning & P2X | 10 | ✅ wired |
| B — P2 Market Imbalance | 1 | ✅ wired |
| C — P3 SCL Generator | 1 | ✅ wired |
| D — P1 Research Lab | 8 | ✅ wired |
| E — Live nacelle subsystems | 4 | ✅ wired (polling) |
| **Total newly exposed** | **32** | — |

To keep this audit green, future endpoint additions should ship with at least
one frontend caller in the same PR.
