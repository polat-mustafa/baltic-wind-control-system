# Gap Analysis: Baltic Wind Control System vs Reference Open-Source Projects

**Date:** 2026-03-16
**Scope:** Baltic Wind HV Control Platform (510 MW, 34 × V236-15.0 MW)
**Reference Projects:** PyPSA, FLORIS, WindSE
**Purpose:** Identify missing features and capabilities to guide system architecture improvements

---

## 1. Executive Summary

This document compares the Baltic Wind Control System against three leading open-source projects in the wind energy and power systems domain:

| Project | Domain | GitHub |
|---------|--------|--------|
| **PyPSA** | Power system analysis, optimal power flow, energy system optimization | [PyPSA/PyPSA](https://github.com/PyPSA/PyPSA) |
| **FLORIS** | Wind farm wake modeling, yaw optimization, farm control | [NREL/floris](https://github.com/NREL/floris) |
| **WindSE** | CFD-based wind farm simulation, adjoint optimization | [NREL/WindSE](https://github.com/NREL/WindSE) |

### Coverage Scorecard

| Reference Project | Their Capabilities | Baltic Wind Covers | Coverage |
|-------------------|-------------------|-------------------|----------|
| PyPSA | 15 major features | 3 (power flow, N-1 contingency, network modeling) | ~20% |
| FLORIS | 14 major features | 4 (BPA wake model, layout optimization, AEP, wind rose) | ~29% |
| WindSE | 11 major features | 1 (layout optimization — different method) | ~9% |

**Important context:** These coverage numbers are misleading in isolation. Baltic Wind has extensive capabilities that *none* of these projects offer — SCADA/IEC 61850, ML forecasting, commissioning workflows, digital twin, protection relay simulation, and a full-stack web UI. The comparison is strictly within the overlapping domains.

---

## 2. What Baltic Wind Already Does Well

Before listing gaps, it's important to acknowledge the system's existing strengths — areas where Baltic Wind meets or exceeds the reference projects:

### Unique to Baltic Wind (not in any reference project)
- **SCADA & IEC 61850 Substation Automation** (P3) — Device registry, GOOSE simulation, SCL generation, alarm management, historian, OPC-UA modeling
- **ML-Powered Forecasting Pipeline** (P4) — LSTM, TFT, XGBoost, ensemble models with SHAP explainability, ramp detection, NWP integration
- **HV Commissioning Simulation** (P5) — Switching programmes, protection relay coordination, FAT/SAT tracking, LOTO, emergency response, grid code testing
- **Digital Twin Engine** — Real-time model vs actual comparison, anomaly classification, health scoring, residual analysis
- **Turbine Physics Simulator** — Time-stepping Cp(λ,β) surface, pitch/yaw control, rotor dynamics, drivetrain model
- **Full-Stack Web Application** — React dashboards for every module, interactive maps, real-time visualization
- **Integrated Safety Workflows** — Permit-to-work, RBAC (IEC 62443), equipment state machines

### Competitive with Reference Projects
- **BPA Gaussian Wake Model** (`backend/app/services/p1/wake_model.py`) — Industry-standard model via PyWake, equivalent to FLORIS's Gauss model
- **Layout Optimization** (`backend/app/services/p1/layout_optimizer.py`) — Differential evolution with spacing constraints, similar scope to FLORIS
- **AEP Loss Cascade** (`backend/app/services/p1/aep_calculator.py`) — Full gross-to-net with P50/P75/P90/P99 exceedance, RSS uncertainty
- **Newton-Raphson Load Flow** (`backend/app/services/p2/load_flow.py`) — 4 operating scenarios with STATCOM auto-dispatch
- **IEC 60909 Short Circuit** (`backend/app/services/p2/short_circuit.py`) — Full bus-level analysis
- **Network Modeling** (`backend/app/services/p2/network_model.py`) — Complete 66/220/400 kV pandapower model with pi-model cables
- **Blockage Model** (`backend/app/services/p1/blockage.py`) — Nygaard et al. (2020) empirical method
- **FRT Simulation** (`backend/app/services/p2/frt_simulation.py`) — Fault ride-through analysis
- **SSO Analysis** (`backend/app/services/p2/sso_analysis.py`) — Sub-synchronous oscillation study
- **Frequency Response** (`backend/app/services/p2/frequency_response.py`) — Grid frequency dynamics
- **Power Plant Controller** (`backend/app/services/p2/power_plant_controller.py`) — Voltage, frequency, and power control

---

## 3. Gap Analysis by Category

### A. Wake Modeling & Aerodynamics

**Current state:** Baltic Wind uses a single wake model — BPA Gaussian via PyWake (`wake_model.py:configure_wake_model`) with LinearSum superposition and STF2017 turbulence model.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| A1 | Multiple wake models | FLORIS offers 5 wake models: Jensen (top-hat), Gauss, Empirical Gauss, Gauss-Curl Hybrid (GCH), and Curl. Each has different accuracy/speed trade-offs. GCH captures secondary steering effects. | FLORIS | Medium | PyWake already includes Jensen and other models. Add a `wake_model_type` parameter to `configure_wake_model()` and expose model selection in the API. Estimated: extend `wake_model.py` with ~50 lines. |
| A2 | Wake steering / yaw optimization | FLORIS demonstrates up to 14.66% farm power improvement by optimizing individual turbine yaw angles to deflect wakes away from downstream turbines. This is the primary control strategy in modern wind farm operations. | FLORIS | **High** | Create `backend/app/services/p1/yaw_optimizer.py`. PyWake supports yaw-aware simulations. Add yaw angles as optimization variables. Integrate with existing `layout_optimizer.py` framework. |
| A3 | Helix control | Active wake mixing using individual pitch actuation to enhance wake recovery. An emerging research technique for farm-level control. | FLORIS | Low | Research-grade feature. Defer until turbine physics simulator (P5) supports individual blade pitch. |
| A4 | Derating control | Power setpoint reduction as a control variable — trading individual turbine power for improved downstream conditions. | FLORIS | Medium | Add derating factor to turbine model in `wake_model.py`. Modify power curve lookup to accept a derating coefficient [0-1]. |
| A5 | Heterogeneous / dynamic flow fields | FLORIS's FLORIDyn model handles spatially varying wind conditions and time-varying inflow — more realistic than uniform site assumption. | FLORIS | Low | Current `create_uniform_site()` and `create_site_from_wind_rose()` assume spatial uniformity. PyWake supports `XRSite` for heterogeneous fields. Add as advanced option. |
| A6 | Turbulence intensity wake model | FLORIS uses Crespo & Hernández added turbulence model. Baltic Wind has STF2017 (Frandsen-based), which is comparable but different. Offering both enables comparison studies. | FLORIS | Medium | PyWake includes multiple TI models. Add model selection parameter alongside wake deficit model choice. |

### B. CFD & High-Fidelity Flow Simulation

**Current state:** Baltic Wind uses engineering wake models (analytical/empirical). No CFD capability exists.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| B1 | RANS-based CFD simulation | WindSE solves Reynolds-Averaged Navier-Stokes equations with k-ε turbulence for full 3D flow field resolution. Orders of magnitude more accurate than engineering models for complex terrain. | WindSE | Low | Requires FEniCS dependency and significant computational resources. Not practical for a web-based educational platform. Consider as a separate offline module if research-grade fidelity is needed. |
| B2 | Actuator disk / actuator line | WindSE represents turbines as momentum sinks (actuator disk) or rotating line forces (actuator line) within the CFD domain. Captures root/tip vortex details. | WindSE | Low | Coupled with CFD solver. Not applicable without B1. |
| B3 | 3D terrain modeling | WindSE integrates terrain data into the flow domain, capturing terrain-induced flow separation, wake curvature, and ABL effects. | WindSE | Low | Baltic Wind's offshore site has flat terrain (open sea). Terrain modeling is more relevant for onshore/coastal farms. Low priority for Baltic Sea application. |
| B4 | Automatic mesh generation | WindSE auto-generates meshes with conformal adaptation to turbine representations, including refined meshing upwind/downstream. | WindSE | Low | Part of CFD infrastructure. Not applicable without B1. |

### C. Optimization Algorithms

**Current state:** Baltic Wind uses `scipy.optimize.differential_evolution` for layout optimization (`layout_optimizer.py:optimize_layout`). Single-objective (maximize AEP), single-method.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| C1 | Gradient-based layout optimization | FLORIS uses exact gradients via algorithmic differentiation for fast convergence. WindSE uses adjoint methods via dolfin-adjoint. Both are significantly faster than evolutionary methods for smooth objective landscapes. | FLORIS, WindSE | Medium | PyWake supports gradient computation. Add `scipy.optimize.minimize` (L-BFGS-B) as an alternative optimizer in `layout_optimizer.py`. Use finite differences initially, then explore PyWake's built-in gradient support. |
| C2 | Multi-algorithm optimization | FLORIS supports basin-hopping and genetic algorithms alongside gradient methods. Different algorithms suit different landscape properties. | FLORIS | Medium | Add `scipy.optimize.basinhopping` and a simple GA wrapper to `layout_optimizer.py`. Let the user select algorithm. ~100 lines of code. |
| C3 | Yaw angle optimization | FLORIS optimizes per-turbine yaw angles (typically 0-30°) to maximize total farm power. This is the most impactful missing optimization capability for real-world operations. | FLORIS | **High** | Create `backend/app/services/p1/yaw_optimizer.py` with yaw angles as decision variables. Use existing `run_wake_analysis()` with yaw parameter. Add corresponding API endpoint and frontend panel. |
| C4 | Simultaneous multi-variable optimization | WindSE optimizes turbine positions, yaw angles, AND axial induction simultaneously in a high-dimensional space. | WindSE | Low | Requires adjoint methods for efficiency. Can approximate by chaining position and yaw optimization sequentially. |
| C5 | PDE-constrained optimization | WindSE formulates layout optimization as a PDE-constrained problem where RANS equations serve as equality constraints. Mathematically rigorous but computationally expensive. | WindSE | Low | Academic approach. Not practical for the platform's educational/engineering scope. |

### D. Uncertainty & Stochastic Analysis

**Current state:** Baltic Wind has RSS uncertainty combination (`aep_calculator.py:compute_rss_uncertainty`) and P-value exceedance calculation. No advanced UQ methods.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| D1 | Polynomial Chaos UQ | FLORIS uses Polynomial Chaos expansion for efficient quantification of stochastic variables (wind direction/speed uncertainty). Much more rigorous than RSS. | FLORIS | Medium | Add `chaospy` library. Create `backend/app/services/p1/uncertainty.py` that wraps AEP calculation with PC expansion. Input: distribution of wind direction/speed. Output: AEP distribution with confidence intervals. |
| D2 | Two-stage stochastic optimization | PyPSA supports optimization under uncertainty with scenario-weighted inputs. First stage: investment decisions. Second stage: operational decisions per scenario. | PyPSA | Medium | Relevant if capacity expansion (F4) is implemented. Create scenario generator that samples wind/demand profiles and runs OPF for each. |
| D3 | Robust optimization | FLORIS accounts for input uncertainties directly in the optimization objective, producing layouts/yaw settings that perform well across a range of conditions, not just the expected case. | FLORIS | Medium | Modify optimization objective to minimize worst-case or expected AEP over a distribution of wind conditions. Extend `layout_optimizer.py` objective function. |
| D4 | Modelling-to-Generate-Alternatives | PyPSA's MGA explores near-optimal decision spaces — finding feasible configurations that are different from the optimum but nearly as good. Useful for stakeholder engagement. | PyPSA | Low | Add constraint to optimization: "find solution with AEP within 5% of optimal but maximally different in layout." Academic feature. |

### E. AEP Estimation Methods

**Current state:** Baltic Wind calculates AEP by running full PyWake simulations across all wind directions/speeds and summing weighted results. Accurate but computationally expensive.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| E1 | FLOWERS analytical AEP | FLORIS's FLOWERS method computes AEP via analytical integration rather than discrete summation — extremely fast (seconds vs minutes). Uses integral formulation over the wind rose. | FLORIS | Medium | Implement in `backend/app/services/p1/flowers_aep.py`. The method approximates wake deficits as Gaussian and integrates analytically over wind rose. Useful for rapid layout screening before full simulation. ~200 lines. |
| E2 | Gaussian FLOWERS | Wind-rose-based analytical integration that further speeds up AEP estimation. A refinement of E1. | FLORIS | Low | Extension of E1. Implement after FLOWERS base method is validated. |
| E3 | Market value-weighted AEP | FLORIS weights energy production by time-varying market prices, giving revenue-optimized rather than energy-optimized results. A turbine producing more during high-price hours is worth more. | FLORIS | Medium | Extend `aep_calculator.py` to accept hourly price time series. Modify cascade to weight AEP by price. Add `price_weighted_aep_gwh` field to `AEPCascadeResult`. |

### F. Power System Optimization

**Current state:** Baltic Wind performs power flow analysis (Newton-Raphson) and checks voltage compliance. No optimization of dispatch, investment, or network configuration.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| F1 | Linear Optimal Power Flow (LOPF) | PyPSA minimizes generation cost subject to network constraints (line capacities, voltage limits). Answers: "What is the least-cost way to dispatch this wind farm while respecting grid limits?" | PyPSA | **High** | Add `backend/app/services/p2/optimal_power_flow.py`. Pandapower has `pp.runopp()` for AC OPF and `pp.rundcopp()` for DC OPF. Extend existing `network_model.py` with generator cost functions. |
| F2 | Security-Constrained LOPF (SCLOPF) | PyPSA optimizes dispatch while ensuring N-1 security — the system remains feasible even if any single element fails. Currently Baltic Wind only checks N-1 via separate load flow runs. | PyPSA | **High** | Extend F1 to iterate over contingencies. For each contingency (line/transformer outage), add constraint that power flow remains feasible. Use `pp.runopp()` with contingency list. |
| F3 | Economic dispatch & unit commitment | PyPSA determines optimal generator scheduling including startup/shutdown decisions, minimum up/down times, and ramp rate constraints. | PyPSA | Medium | Relevant when multiple generation sources exist (wind + storage + grid import). Create time-series dispatch optimizer that respects generator constraints. |
| F4 | Capacity expansion planning | PyPSA determines optimal investment in new generation/storage/network capacity over multiple time periods. Answers: "Should we add battery storage? How much?" | PyPSA | Medium | Create `backend/app/services/p2/capacity_planning.py`. Model candidate investments (BESS, STATCOM upgrade, cable reinforcement) with annualized costs. Optimize using linear programming. |
| F5 | Pathway planning | PyPSA models multi-decade energy transition pathways with sequential investment decisions. | PyPSA | Low | Very long-term strategic planning. Beyond the scope of a single wind farm simulation. |

### G. Energy Storage & Sector Coupling

**Current state:** No energy storage or sector coupling modeling exists in Baltic Wind.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| G1 | Battery energy storage (BESS) | PyPSA models short-duration battery storage with charge/discharge cycles, efficiency losses, and state-of-charge tracking. Increasingly paired with offshore wind for grid services. | PyPSA | Medium | Add BESS element to pandapower network model. Create `backend/app/services/p2/storage.py` with charge/discharge logic, round-trip efficiency, and degradation model. Add storage bus at OSS. |
| G2 | Sector coupling (heat + hydrogen) | PyPSA integrates electricity with heat networks and hydrogen production. Models electrolyzers, heat pumps, and fuel cells as flexible loads. | PyPSA | Low | Beyond current project scope (electrical engineering focus). Consider as future extension for integrated energy system studies. |
| G3 | Power-to-gas / electrolyzer | PyPSA models hydrogen production from surplus wind power. Relevant for offshore wind + green hydrogen projects. | PyPSA | Low | Growing industry relevance (North Sea hydrogen projects). Add as standalone module if green hydrogen use case arises. |
| G4 | Seasonal storage | PyPSA models long-duration storage (power-to-gas, thermal, compressed air). | PyPSA | Low | Research-grade feature for energy system planning. Not typically part of single wind farm analysis. |

### H. Grid & Network Advanced Features

**Current state:** Baltic Wind models a single radial AC network (66/220/400 kV) with pandapower. No meshed networks, no DC power flow, no multi-carrier.

| # | Gap | Description | Source | Priority | Implementation Approach |
|---|-----|-------------|--------|----------|------------------------|
| H1 | Meshed AC-DC hybrid networks | PyPSA models interconnected AC and DC grids with converter stations. Relevant for HVDC export cables and multi-terminal DC grids. | PyPSA | Medium | Baltic Wind already has HVAC/HVDC converter comparison (`converter_comparison.py`). Extend to model full HVDC topology with rectifier/inverter stations using pandapower's DC elements. |
| H2 | Flexible demand / load shedding | PyPSA models elastic loads that can be curtailed or shifted in time. Relevant for grid balancing with variable wind generation. | PyPSA | Low | Add curtailable load elements to network model. Implement in dispatch optimization (F3). |
| H3 | Multi-energy carrier integration | PyPSA's multi-carrier framework couples electricity, gas, heat, and hydrogen networks. | PyPSA | Low | Academic/research feature. Not applicable to single wind farm scope. |
| H4 | DC power flow (linearized) | PyPSA supports fast linearized DC power flow for large network screening. Useful for rapid contingency scanning across hundreds of scenarios. | PyPSA | Medium | Pandapower supports DC power flow via `pp.rundcpp()`. Add as fast-screening option in `load_flow.py` for rapid N-k analysis before detailed AC runs. |

---

## 4. Priority Roadmap

### Tier 1: High Priority, High Impact
*Capabilities that would most significantly enhance the platform's value*

| Gap | Description | Estimated Effort | Key Benefit |
|-----|-------------|-----------------|-------------|
| **A2** | Wake steering / yaw optimization | 2-3 days | Farm-level power gain of 5-15%. Core modern wind farm control technique. |
| **C3** | Yaw angle optimization | 2-3 days | Direct complement to A2. Determines optimal yaw setpoints per turbine. |
| **F1** | Linear Optimal Power Flow | 1-2 days | Answers cost-optimization questions. Uses existing pandapower infrastructure. |
| **F2** | Security-Constrained LOPF | 2-3 days | Upgrades N-1 analysis from "check" to "optimize". Industry best practice. |

### Tier 2: Medium Priority, Meaningful Enhancement
*Capabilities that add depth and breadth to existing modules*

| Gap | Description | Estimated Effort |
|-----|-------------|-----------------|
| **A1** | Multiple wake models | 1 day (PyWake already has them) |
| **A4** | Derating control | 1 day |
| **A6** | TI wake models (Crespo & Hernández) | 0.5 days |
| **C1** | Gradient-based layout optimization | 1-2 days |
| **C2** | Multi-algorithm optimization | 1 day |
| **D1** | Polynomial Chaos UQ | 2-3 days |
| **D3** | Robust optimization | 2 days |
| **E1** | FLOWERS analytical AEP | 2-3 days |
| **E3** | Market value-weighted AEP | 1 day |
| **F3** | Economic dispatch | 2-3 days |
| **F4** | Capacity expansion planning | 3-5 days |
| **G1** | Battery energy storage | 2-3 days |
| **H1** | Meshed AC-DC networks | 2-3 days |
| **H4** | DC power flow (linearized) | 0.5 days |

### Tier 3: Future / Research-Grade
*Capabilities that are academically interesting but not essential for the platform's core mission*

| Gap | Description | Rationale for Low Priority |
|-----|-------------|---------------------------|
| A3 | Helix control | Emerging research, requires individual blade pitch |
| A5 | Heterogeneous flow fields | Adds complexity, marginal gain for uniform offshore site |
| B1-B4 | CFD simulation (all) | Requires FEniCS, heavy compute, not suitable for web platform |
| C4-C5 | PDE-constrained / multi-variable | Requires adjoint infrastructure |
| D2 | Stochastic optimization | Depends on F4 capacity planning |
| D4 | MGA | Academic exploration tool |
| E2 | Gaussian FLOWERS | Refinement of E1 |
| F5 | Pathway planning | Multi-decade scope, beyond single farm |
| G2-G4 | Sector coupling, P2G, seasonal storage | Beyond electrical engineering focus |
| H2-H3 | Flexible demand, multi-carrier | Beyond single wind farm scope |

---

## 5. Architectural Recommendations

### Where New Capabilities Fit in the P1-P5 Structure

```
P1 (Wind Resource & Energy Yield)
├── Existing: wake_model.py, layout_optimizer.py, aep_calculator.py, blockage.py
├── NEW: yaw_optimizer.py          ← A2, C3 (wake steering & yaw optimization)
├── NEW: flowers_aep.py            ← E1 (fast analytical AEP)
├── NEW: uncertainty.py            ← D1 (Polynomial Chaos UQ)
├── EXTEND: wake_model.py          ← A1, A6 (multi-model selection, TI models)
├── EXTEND: layout_optimizer.py    ← C1, C2 (gradient-based, multi-algorithm)
└── EXTEND: aep_calculator.py      ← E3 (market-value weighting)

P2 (HV Grid Integration)
├── Existing: load_flow.py, network_model.py, short_circuit.py, ...
├── NEW: optimal_power_flow.py     ← F1, F2 (LOPF, SCLOPF)
├── NEW: storage.py                ← G1 (BESS modeling)
├── NEW: capacity_planning.py      ← F4 (investment optimization)
├── EXTEND: load_flow.py           ← H4 (DC power flow option)
├── EXTEND: network_model.py       ← H1 (HVDC topology)
└── EXTEND: converter_comparison.py ← H1 (full HVDC network model)
```

### Key Design Principles

1. **Extend, don't replace.** All new capabilities should be additions to existing services, not replacements. The current BPA Gaussian model remains the default; additional models are alternatives.

2. **Configuration-driven.** Use enum parameters to select wake models, optimization algorithms, and analysis types. Example: `WakeModelType.BPA_GAUSSIAN | JENSEN | GCH`.

3. **Reuse PyWake/Pandapower.** Both libraries already support most Tier 1 and Tier 2 features. The implementation is primarily about wrapping existing library capabilities in the Baltic Wind service layer and exposing them through the API.

4. **Progressive complexity.** Start with Tier 1 features that have highest impact-to-effort ratio. Each enhancement should be independently testable and deployable.

---

## 6. Summary: What Each Reference Project Teaches Us

| Project | Primary Lesson for Baltic Wind |
|---------|-------------------------------|
| **PyPSA** | Move from "analyze" to "optimize" — add OPF, economic dispatch, and investment planning to the grid module. Think about cost-optimal operation, not just technical feasibility. |
| **FLORIS** | Move from "single wake model" to "wake control" — add yaw optimization, multiple wake models, and fast AEP methods. The biggest real-world impact comes from farm-level control strategies. |
| **WindSE** | High-fidelity CFD is valuable for research but not essential for an engineering platform. The adjoint optimization concept is worth borrowing, but the full FEniCS stack is overkill for this use case. |

### The Honest Bottom Line

Baltic Wind's strength is **breadth and integration** — it covers the full wind farm lifecycle from resource assessment to commissioning in a single platform with a web UI. No reference project comes close to this scope.

The gaps are in **depth within specific domains** — particularly wake control optimization (FLORIS) and power system optimization (PyPSA). Closing the Tier 1 gaps (wake steering, OPF) would bring the platform to a level where it competes meaningfully with specialized tools in their own domains, while maintaining its unique advantage of full-lifecycle integration.
