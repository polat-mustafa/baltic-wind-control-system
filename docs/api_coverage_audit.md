# API Coverage Audit — SB-510 (510 MW) Simulation

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

## Group A — P2 Security & Dynamics (2 endpoints)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/security/n1` | POST | `/hv-grid` → **Security & Dynamics** tab | `AdvancedAnalysisTab` |
| `/api/v1/grid/dynamics/andes` | POST | `/hv-grid` → Security & Dynamics | `AndesDynamicsSection` |

Store: `frontend/src/store/n1SecurityStore.ts`. The ANDES case now carries the
WECC REGCA1/REECA1/REPCA1 plant model and a synchronous area equivalent (the old
builder swallowed add() errors and ran with no converter). OPF/SCOPF, DC power
flow and the passive-network SSO screen were removed: the OPF had nothing to
trade on a radial zero-cost farm, and SSO needs EMT/vendor models.

## Group A2 — P2 Planning & P2X (2 endpoints)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/planning/export` | POST | `/hv-grid` → **Planning & P2X** | `ExportTechSection` |
| `/api/v1/grid/planning/p2x` | POST | `/hv-grid` → Planning & P2X | `P2XSection` |

Store: `frontend/src/store/planningStore.ts`. Replaces ten JSON-card endpoints
(economic dispatch, BESS dispatch, AC/DC comparison, capacity expansion,
pathway, sector coupling, electrolyser, seasonal storage, flexible demand,
multi-energy). Dispatch and BESS duplicated the Market and BESS tabs and
quoted ramp limits that are not PSE values; capacity expansion treated the
platform modules P1–P5 as five wind farms; the national pathway left out
coal; flexible demand and multi-energy were not tied to this farm. The two
studies kept are physics on this farm: AC cable capacity and losses vs HVDC,
and an electrolyser on the energy above a grid limit.

## Group B — P2 Market (1 endpoint)

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/grid/market/day` | POST | `/hv-grid` → **Market** tab | `MarketDashboard` |

Service: `frontend/src/services/marketApi.ts` (`simMarketDay`).

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

## Group D — removed (2026-10)

The eight experimental P1 endpoints (`helix-control`, `dynamic-flow`,
`cfd-simulation`, `simultaneous-optimization`, `adjoint-sensitivities`,
`two-stage-stochastic`, `mga`, `gaussian-flowers-aep`), their services and
the `/research-lab` page were deleted: they were analytical stand-ins whose
labels overstated the method (e.g. "RANS CFD").

## Group E — Live nacelle subsystems (1 endpoint)

The 3D viewer (`/` landing → turbine drill-down) polls this every 2 s while a
viewer is mounted, replacing the previous closed-form temperature/pressure
formulas with deterministic backend physics.

| Endpoint | Method | UI consumer |
|---|---|---|
| `/api/v1/turbine-sim/nacelle/subsystems` | GET | `nacelleSubsystemsStore` (polling) — drives `ThermalOverlay`, `HPUPressureGauge`, `OilFlowLoop` |

The per-subsystem GETs (`/hpu`, `/cooling`, `/safety`) returned blocks of the
same response and had no caller; removed 2026-10-11.

## Group F — Audit 2026-10-11 (wired 9, removed 12)

A full audit found 16 endpoints without a frontend caller. Wired:

| Endpoint | Method | UI route | Component |
|---|---|---|---|
| `/api/v1/wind/wake-model-comparison` | POST | `/wind-resource` → **Wake & Uncertainty Studies** | `WakeStudiesTab` |
| `/api/v1/wind/flowers-aep` | POST | same | `WakeStudiesTab` |
| `/api/v1/wind/yaw-optimization` | POST | same | `WakeStudiesTab` |
| `/api/v1/wind/yaw-optimization-farm` | POST | same | `WakeStudiesTab` |
| `/api/v1/wind/derating` | POST | same | `WakeStudiesTab` |
| `/api/v1/wind/pce-uncertainty` | POST | same | `WakeStudiesTab` |
| `/api/v1/digital-twin/operating-point` | POST | `/digital-twin` → Model | `OperatingPointPanel` |
| `/api/v1/info/sensors` | GET | `/scada` → Equipment → Instruments | `InstrumentRegisterPanel` |
| `/api/v1/scada/cms/turbines/{id}/simulate-fault` | DELETE (new) | `/scada` → Equipment → CMS | Clear button |

Removed: `/forecast/turbine-spec` and `/forecast/power-curve` (duplicates of
`/wind/turbine-spec`), `/grid/bess/status` and `/grid/bess/mode` (a process-wide
mutable state shared by every user), `/scada/opcua/restart` (an unauthenticated
admin action), `/wind/farms/compare/{id}` (read an unbounded in-memory cache),
`/wind/market-weighted-aep` (synthetic random prices gave a value factor > 1,
contradicting the real PSE capture price on the Market tab),
`/wind/layout-optimization` (minutes per run; the Layout page's screened moves
checked with PyWake cover layout improvement) and the three nacelle sub-GETs.
Checked by a route ↔ caller cross-check (169 routes, none without a caller).

Files:
- `frontend/src/services/nacelleSubsystemsApi.ts`
- `frontend/src/store/nacelleSubsystemsStore.ts`
- `frontend/src/components/landing/turbine3d/scene/ThermalOverlay.tsx`
- `frontend/src/components/landing/turbine3d/scene/NacelleInteriorDetail.tsx`

---

## Summary

| Group | Endpoints | Status |
|---|---:|---|
| A — P2 Security & Dynamics | 2 | ✅ wired |
| A2 — P2 Planning & P2X | 2 | ✅ wired |
| B — P2 Market Imbalance | 1 | ✅ wired |
| C — P3 SCL Generator | 1 | ✅ wired |
| E — Live nacelle subsystems | 1 | ✅ wired (polling) |
| F — Audit 2026-10-11 | 9 | ✅ wired (12 removed) |
| **Total newly exposed** | **16** | — |

To keep this audit green, future endpoint additions should ship with at least
one frontend caller in the same PR.
