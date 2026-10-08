# SKILL.md — Offshore Wind HV Control Simulation Platform

## Project Identity

- **Name:** Offshore Wind HV Control Simulation Platform
- **Domain:** Offshore wind energy, HV electrical engineering, SCADA automation, power system analysis
- **Type:** Full-stack educational simulation platform (React + FastAPI + Python computation engines)
- **Quality Bar:** Production-grade, open-source educational tool. Every line of code must be explainable to a junior engineer.

---

## Architecture Overview

```
Frontend:   React 19 + TypeScript + Tailwind CSS v4 + Plotly.js + XYFlow
Backend:    FastAPI (Python 3.13+) + SQLAlchemy + Alembic + Pydantic v2
Database:   PostgreSQL 16 + TimescaleDB extension
Cache:      Redis 7 (real-time state, WebSocket pub/sub)
Realtime:   FastAPI WebSocket + Server-Sent Events
Auth:       RBAC simulation (5 security levels per IEC 62443) — JWT planned
Container:  Docker + Docker Compose
CI/CD:      GitHub Actions
Testing:    pytest (backend) + Vitest (frontend) + Playwright (E2E)
Docs:       Auto-generated OpenAPI (Swagger) from FastAPI
```

### Monorepo Structure

```
baltic-wind-control-system/
├── backend/           # FastAPI Python service
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py        # Pydantic Settings
│   │   ├── db.py            # SQLAlchemy async engine + session
│   │   ├── core/            # Exceptions, middleware, cache, logging
│   │   ├── routers/         # REST endpoints per project (p0-p5, digital_twin, turbine_*)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response
│   │   └── services/        # Business logic + computation (p0-p5, digital_twin, turbine_physics)
│   ├── tests/
│   ├── alembic/
│   ├── pyproject.toml
│   └── uv.lock              # pinned deps — CI uses `uv sync --locked`
├── frontend/          # React TypeScript SPA
│   ├── src/
│   │   ├── pages/           # One page per module
│   │   ├── components/      # React components per project
│   │   ├── constants/       # e.g. scadaColors.ts (single source of truth)
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API client layer
│   │   ├── store/           # Zustand state management
│   │   └── types/           # TypeScript interfaces
│   ├── tests/
│   └── package.json
├── docker-compose.yml
└── docs/
```

---

## Critical Domain Rules

### NEVER Violate These Engineering Principles

1. **Physical constraints are non-negotiable.** Power output MUST be ≥ 0 and ≤ Prated. Wind speed below cut-in or above cut-out means zero power. No exceptions. No ML model prediction overrides physics.
   SB-510's turbine is a "V236 class" machine modelled with the IEA-15-240-RWT (official IEA Wind Task 37 table, `services/p1/turbine_models.py`): cut-in 3 m/s, rated 10.66 m/s, cut-out 25 m/s, D 241.35 m, hub 150 m. Low-speed direct drive (200-pole PMSG, no gearbox), rotor 5.0–7.56 rpm, overspeed trip 9.07 rpm; P4, the digital twin and turbine physics use the same model (ROSCO Cp/Ct table and controller: `rosco()` in the same module).

2. **Per-unit (pu) system must be consistent.** All voltage values in power system calculations use per-unit. Base voltage = nominal voltage of the bus. Base power = system MVA base (typically 100 MVA). NEVER mix absolute and per-unit values in the same calculation.

3. **IEC 60909 method for short-circuit.** Use the voltage factor c from IEC 60909-0 Table 1: for our MV/HV buses (66/220/400 kV) cmax=1.10, cmin=1.00 (cmin=0.95 applies only to LV ≤ 1 kV). Calculate Ik'' (initial symmetrical), ip (peak), Ib (breaking), and Ith (thermal). Pandapower handles this — do NOT implement from scratch.

4. **Reactive power sign convention.** Generating reactive power = positive Q (capacitive source, inductive load compensation). Absorbing reactive power = negative Q (inductive source, capacitive load compensation). STATCOM absorbing cable reactive power → Q is negative from STATCOM perspective.

5. **GOOSE messages operate at Layer 2 Ethernet.** They do NOT use IP/TCP. Latency must be < 4 ms. Never simulate GOOSE over HTTP/WebSocket and call it realistic — clearly label it as a simplified educational simulation.

6. **Time-series cross-validation NEVER shuffles.** Use `TimeSeriesSplit` from scikit-learn. Training data is always before validation data. Violating temporal ordering creates data leakage and unrealistically high accuracy.

7. **Cable reactive power is always positive (capacitive).** Q_cable = ω × C × V² × L. This pushes voltage up (Ferranti effect). Compensation must absorb this Q to maintain voltage within ±5% of nominal.

8. **Protection relay time grading:** Nearest relay to fault trips first. Backup relay has a time delay (typically 200-300 ms grading margin). NEVER have upstream relay trip before downstream relay — this is non-selective and causes unnecessary outage.

9. **IEC 61850 is a data model, not a protocol.** MMS (client-server over TCP/IP) and GOOSE (peer-to-peer over Ethernet L2) are communication mappings. The same logical node structure applies regardless of transport.

10. **Uncertainty is not optional.** Every AEP number must have an associated uncertainty. P50 = 50% exceedance. P90 = 90% exceedance. Revenue calculations for lenders use P90. Combined uncertainty uses RSS (root sum of squares) of independent sources.

---

## Code Style & Quality Standards

### Python (Backend + Computation)

```python
# ALWAYS use type hints for all function signatures
def calculate_wake_deficit(
    x_downstream: float,      # meters from upstream turbine
    rotor_diameter: float,     # meters
    ct: float,                 # thrust coefficient (dimensionless)
    turbulence_intensity: float = 0.06,  # typical offshore TI
) -> float:
    """
    Calculate wake velocity deficit using the Bastankhah & Porté-Agel (2014) Gaussian model.
    
    The Gaussian wake model assumes the wake velocity deficit follows a 
    Gaussian distribution in the cross-stream direction, with the deficit
    magnitude decreasing downstream as the wake expands.
    
    Parameters
    ----------
    x_downstream : float
        Distance downstream from the turbine rotor plane [m]
    rotor_diameter : float
        Rotor diameter of the upstream turbine [m]
    ct : float
        Thrust coefficient at the operating wind speed [-]
    turbulence_intensity : float, optional
        Ambient turbulence intensity [-], default 0.06 (typical offshore)
    
    Returns
    -------
    float
        Maximum velocity deficit at wake center [-]
        Value between 0 (no deficit) and 1 (full deficit)
    
    References
    ----------
    Bastankhah, M. & Porté-Agel, F. (2014). A new analytical model for
        wind-turbine wakes. Renewable Energy, 70, 116-123.
    Niayifar, A. & Porté-Agel, F. (2016). Energies, 9(9), 741  (k* = f(TI)).
    """
    # Wake expansion rate k* (Niayifar & Porté-Agel 2016 fit)
    k_star = 0.3837 * turbulence_intensity + 0.003678

    # Characteristic wake width at x_downstream (initial width σ0 = D/√8)
    sigma = k_star * x_downstream + rotor_diameter / np.sqrt(8)

    # Maximum velocity deficit at wake center. The radicand goes negative in
    # the near wake (small x, high Ct) where the model is invalid → clamp to 0.
    radicand = max(1 - ct / (8 * (sigma / rotor_diameter) ** 2), 0.0)
    deficit = 1 - np.sqrt(radicand)

    return float(np.clip(deficit, 0.0, 1.0))
```

**Python standards:**
- Python 3.13+ with full type hints (PEP 484, PEP 604 for union types)
- Pydantic v2 for all data validation
- async/await for all I/O operations in FastAPI
- NumPy docstring format for all public functions
- Engineering units ALWAYS documented in docstrings and variable names
- `ruff` for linting + formatting (`ruff format` replaces `black`), `mypy` for type checking
- Domain-specific variable names (not generic `x`, `y`, `data`)

**Naming conventions for engineering quantities:**

```python
# GOOD — clear engineering names with units
voltage_pu: float = 1.03        # per-unit
voltage_kv: float = 226.6       # kilovolts
power_mw: float = 510.0         # megawatts
reactive_power_mvar: float = 260.0  # megavolt-ampere reactive
current_ka: float = 18.3        # kiloamperes
frequency_hz: float = 50.0      # hertz
wind_speed_ms: float = 9.5      # meters per second
distance_km: float = 45.0       # kilometers
cable_capacitance_nf_per_km: float = 190.0  # nanofarads per km (codebase uses nF/km)

# BAD — ambiguous
v = 1.03       # voltage? velocity? volume?
p = 500        # power? pressure? probability?
q = 85.5       # reactive power? heat? quality?
```

### TypeScript (Frontend)

```typescript
// ALWAYS define interfaces for domain objects
interface TurbineState {
  id: string;                    // e.g., "WTG_01"
  status: TurbineStatus;        // running | stopped | error | maintenance
  activePowerMW: number;        // 0 to 15.0
  reactivePowerMVAR: number;    // typically -5 to +5
  windSpeedMS: number;          // m/s at nacelle
  windDirectionDeg: number;     // 0-360, meteorological convention
  rotorSpeedRPM: number;        // revolutions per minute
  bladePitchDeg: number;        // degrees
  nacelleTemperatureC: number;  // Celsius
  timestamp: string;            // ISO 8601 format
}

// String-literal unions for well-defined states (codebase convention — no `enum`)
type TurbineStatus = 'running' | 'stopped' | 'error' | 'maintenance' | 'curtailed';

// Switching equipment states
type SwitchPosition =
  | 'open'
  | 'closed'
  | 'intermediate'  // transitioning
  | 'unknown';      // communication failure
```

**TypeScript standards:**
- Strict mode enabled (`"strict": true` in tsconfig)
- Interfaces for all API responses and domain objects
- String-literal union types for all finite state sets (no TS `enum` — they emit runtime code and don't match JSON payloads 1:1)
- No `any` type — use `unknown` if type is truly unknown
- React components: functional with hooks only, no class components
- Zustand for state management (lightweight, TypeScript-native)

### Safety-Critical Color Coding (ISA-101 + ISA-18.2 / EEMUA 191)

The single source of truth is `frontend/src/constants/scadaColors.ts` — never hard-code
SCADA colors in components, import `SCADA_COLORS` / `EQUIPMENT_STATE_COLOR` / `VOLTAGE_COLOR`.

Principles (ISA-101 High Performance HMI):
- Grey/desaturated for normal state; vivid color is reserved for abnormal conditions and alarms.
- No pure RGB (`#FF0000`, `#00FF00`) — eye strain over 12-hour shifts.
- Alarm priority colors (P1 red → P4 blue) follow ISA-18.2 / EEMUA 191 and must stay distinct from equipment-state colors.
- Voltage-level colors (400/220/66 kV) are a project convention, not an IEC standard; SLDs also differentiate by stroke width.
- Color is never the only cue (accessibility): pair it with text, shape or icon.

---

## Database Schema Design

### Core Tables

```sql
-- Wind farm configuration (P1)
CREATE TABLE wind_farm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    capacity_mw DOUBLE PRECISION NOT NULL,
    num_turbines INTEGER NOT NULL,
    turbine_model VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turbine positions (P1)
CREATE TABLE turbine_position (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wind_farm_id UUID REFERENCES wind_farm(id) ON DELETE CASCADE,
    turbine_id VARCHAR(20) NOT NULL,  -- e.g., "WTG_01"
    x_m DOUBLE PRECISION NOT NULL,     -- easting in meters (local coordinate)
    y_m DOUBLE PRECISION NOT NULL,     -- northing in meters
    hub_height_m DOUBLE PRECISION NOT NULL DEFAULT 150.0,
    UNIQUE(wind_farm_id, turbine_id)
);

-- SCADA time-series data (P3, P4) — TimescaleDB hypertable
CREATE TABLE scada_measurement (
    time TIMESTAMPTZ NOT NULL,
    turbine_id VARCHAR(20) NOT NULL,
    active_power_mw DOUBLE PRECISION,
    reactive_power_mvar DOUBLE PRECISION,
    wind_speed_ms DOUBLE PRECISION,
    wind_direction_deg DOUBLE PRECISION,
    rotor_speed_rpm DOUBLE PRECISION,
    blade_pitch_deg DOUBLE PRECISION,
    nacelle_temp_c DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'running'
);
SELECT create_hypertable('scada_measurement', 'time');

-- Permit to Work (P3, P5)
CREATE TABLE permit_to_work (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ptw_number VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    work_description TEXT NOT NULL,
    equipment_id VARCHAR(50) NOT NULL,
    risk_level VARCHAR(10) NOT NULL,  -- LOW, MEDIUM, HIGH, CRITICAL
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    person_in_control UUID REFERENCES users(id),
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN (
        'REQUESTED', 'RISK_ASSESSED', 'APPROVED', 'ISOLATION_CONFIRMED',
        'LOTO_APPLIED', 'ACTIVE', 'WORK_COMPLETE', 'LOTO_REMOVED',
        'ENERGISATION_READY', 'CLOSED', 'CANCELLED'
    ))
);

-- PtW audit trail (P3) — every state change is logged
CREATE TABLE ptw_audit_log (
    id BIGSERIAL PRIMARY KEY,
    ptw_id UUID REFERENCES permit_to_work(id),
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    performed_by UUID REFERENCES users(id),
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Switching programme steps (P5)
CREATE TABLE switching_step (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL,
    step_number VARCHAR(10) NOT NULL,     -- e.g., "S-001"
    planned_time TIMESTAMPTZ,
    action TEXT NOT NULL,
    equipment_id VARCHAR(50) NOT NULL,
    expected_state_before VARCHAR(20) NOT NULL,
    expected_state_after VARCHAR(20) NOT NULL,
    verification_method TEXT NOT NULL,
    responsible VARCHAR(50) NOT NULL,      -- PiC, Local, SCADA
    pic_confirmation_required BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, EXECUTING, COMPLETED, FAILED, SKIPPED
    actual_time TIMESTAMPTZ,
    performed_by UUID,
    notes TEXT
);
```

---

## API Design Patterns

### REST Endpoints Convention

```python
# All endpoints follow: /api/v1/{project}/{resource}   (kebab-case resources)
# Project prefixes (see backend/app/routers/, live list at /docs):
#   /api/v1/info            P0 project info (sensor register, …)
#   /api/v1/wind            P1 Wind Resource & AEP
#   /api/v1/grid            P2 HV Grid (+ PPC, OPF, cable DTS)
#   /api/v1/scada           P3 SCADA & IEC 61850
#   /api/v1/forecast        P4 ML Forecasting
#   /api/v1/commissioning   P5 HV Commissioning
#   /api/v1/digital-twin, /api/v1/turbine-physics, /api/v1/turbine-sim/nacelle

# Real examples:
GET    /api/v1/wind/turbine-spec                # V236-15.0 spec
POST   /api/v1/wind/wake-analysis               # PyWake wake analysis
GET    /api/v1/grid/load-flow/{scenario}        # Newton-Raphson load flow
GET    /api/v1/grid/short-circuit/{case}        # IEC 60909 (case = max | min)
POST   /api/v1/grid/frt/{frt_type}              # FRT simulation
POST   /api/v1/grid/ppc/simulate                # Power Plant Controller
```

Rules: GET for pure/idempotent computations with no body, POST when the request carries
parameters or triggers a long computation; every route declares `response_model=`.

### Pydantic Schema Examples

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import StrEnum

class LoadFlowScenario(StrEnum):
    FULL_LOAD = "full_load"          # 510 MW
    PARTIAL_LOAD = "partial_load"    # 255 MW
    NO_LOAD = "no_load"              # 0 MW (Ferranti check)
    N_MINUS_1 = "n_minus_1"          # One cable out of service

class LoadFlowRequest(BaseModel):
    scenario: LoadFlowScenario
    wind_power_mw: float = Field(ge=0, le=510, description="Total wind farm output [MW]")
    statcom_mode: str = Field(default="auto", pattern="^(auto|absorb|generate|off)$")
    
class BusResult(BaseModel):
    bus_id: int
    name: str
    voltage_pu: float = Field(description="Voltage magnitude [per-unit]")
    voltage_kv: float = Field(description="Voltage magnitude [kV]")
    compliant: bool = Field(description="Within ±5% of nominal")
    
class LoadFlowResponse(BaseModel):
    scenario: str
    converged: bool
    buses: list[BusResult]
    total_loss_mw: float
    total_loss_percent: float
    statcom_q_mvar: float = Field(description="STATCOM reactive power output [MVAR], negative=absorbing")
    timestamp: datetime

class SwitchingStepExecute(BaseModel):
    step_id: str
    operator_id: str
    pic_confirmed: bool = Field(description="Person in Control verbal confirmation received")
    actual_state_after: str
    notes: str = ""
    
    @field_validator('pic_confirmed')
    @classmethod
    def pic_must_confirm(cls, v: bool) -> bool:
        # PiC confirmation is mandatory for all steps — never skip
        if not v:
            raise ValueError("Person in Control confirmation is MANDATORY. Cannot proceed without PiC GO decision.")
        return v
```

---

## Computation Engine Integration Patterns

### PyWake (P1)

Reference implementation: `backend/app/services/p1/wake_model.py`.

```python
# ALWAYS use this pattern for PyWake integration (PyWake 2.6)
from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
from py_wake.site import UniformWeibullSite
from py_wake.superposition_models import LinearSum
from py_wake.turbulence_models import STF2017TurbulenceModel
from py_wake.wind_farm_models import All2AllIterative
from py_wake.wind_turbines import WindTurbine
from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

def run_wake_analysis(x_m: np.ndarray, y_m: np.ndarray, site: UniformWeibullSite) -> WakeResult:
    """Run wake analysis using the PyWake Bastankhah Gaussian deficit model.

    CPU-bound and synchronous — call from FastAPI via `run_in_threadpool`, never block the event loop.
    """
    # 1. Turbine: V236-15.0 from tabulated power/Ct curves (see HUB_HEIGHT_M in wake_model.py)
    turbine = WindTurbine(
        name="V236-15.0",
        diameter=236.0,       # [m]
        hub_height=150.0,     # [m]
        powerCtFunction=PowerCtTabular(ws_ms, power_kw, "kW", ct),
    )

    # 2. Wind farm model = deficit model + superposition + turbulence
    #    (the *Deficit class is a component, not a callable farm model)
    wf_model = All2AllIterative(
        site,
        turbine,
        wake_deficitModel=BastankhahGaussianDeficit(),
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
    )

    # 3. Run simulation
    sim_res = wf_model(x=x_m, y=y_m)

    # 4. Extract results — PyWake aep() already returns GWh (no unit conversion)
    net_gwh = float(sim_res.aep().sum())
    gross_gwh = float(sim_res.aep(with_wake_loss=False).sum())
    wake_loss_pct = (1.0 - net_gwh / gross_gwh) * 100.0 if gross_gwh > 0 else 0.0
    ...
```

### Pandapower (P2)

Reference implementations: `backend/app/services/p2/network_model.py`, `short_circuit.py` (Pandapower 3.x).

```python
# ALWAYS validate network before running calculations
import pandapower as pp
import pandapower.shortcircuit as sc

def run_load_flow(scenario: LoadFlowScenario) -> LoadFlowResponse:
    """Run Newton-Raphson load flow using Pandapower."""
    
    net = build_network_model()  # Build the 66/220/400 kV network
    
    # Set generation based on scenario
    set_scenario_generation(net, scenario)
    
    # Run load flow
    pp.runpp(net, algorithm='nr', init='auto', max_iteration=100)
    
    if not net.converged:
        raise CalculationError(f"Load flow did not converge for scenario: {scenario}")
    
    # Validate results
    v_min = net.res_bus.vm_pu.min()
    v_max = net.res_bus.vm_pu.max()
    
    if v_min < 0.90 or v_max > 1.10:
        logger.warning(f"Extreme voltage detected: V_min={v_min:.3f}, V_max={v_max:.3f}")
    
    return build_load_flow_response(net, scenario)

def run_short_circuit_iec60909(net) -> ShortCircuitResult:
    """Run IEC 60909 short-circuit calculation."""

    # Max short-circuit (for equipment rating). Pandapower picks c from
    # IEC 60909 Table 1 by bus voltage (HV: cmax 1.10 / cmin 1.00).
    sc.calc_sc(net, fault='3ph', case='max', ip=True, ith=True,
               branch_results=True)
    
    results = []
    for bus_idx in net.res_bus_sc.index:
        results.append(ShortCircuitBusResult(
            bus_id=bus_idx,
            ikss_ka=float(net.res_bus_sc.at[bus_idx, 'ikss_ka']),   # Initial symmetrical
            ip_ka=float(net.res_bus_sc.at[bus_idx, 'ip_ka']),       # Peak
            ith_ka=float(net.res_bus_sc.at[bus_idx, 'ith_ka']),     # Thermal equivalent
        ))
    
    return ShortCircuitResult(buses=results)
```

---

## Testing Strategy

### Test Categories

```python
# Unit tests: Pure computation functions
def test_wake_deficit_at_8d_downstream():
    """Below-rated (Ct≈0.8) deficit at 8D, TI 6% ≈ 17% (hand calc: 0.170)."""
    deficit = calculate_wake_deficit(
        x_downstream=8 * 236,  # 8 rotor diameters
        rotor_diameter=236,
        ct=0.8,                # below rated; above rated Ct≈0.3 gives only ~6%
        turbulence_intensity=0.06,
    )
    assert 0.15 < deficit < 0.20, f"Wake deficit {deficit:.3f} outside expected range"

def test_cable_reactive_power():
    """One 76.5 km 220 kV export circuit, C = 190 nF/km → Q = ωCV²L ≈ 221 MVAR (three-phase, V = V_LL).
    The farm has 2 parallel export cables → ≈ 442 MVAR in total (the function's default)."""
    q_mvar = calculate_cable_reactive_power(
        c_nf_per_km=190.0,
        voltage_kv=220.0,
        length_km=45.0,
        num_cables=1,
    )
    assert 125 < q_mvar < 135, f"Cable Q={q_mvar:.1f} MVAR outside expected range"

def test_physical_constraints_enforcement():
    """ML prediction must be clipped to physical limits."""
    raw_prediction = np.array([16.0, -2.0, 5.0, 0.5])
    wind_speed = np.array([15.0, 8.0, 2.0, 35.0])  # 2.0 = below cut-in, 35.0 = above cut-out

    result = enforce_physical_constraints(raw_prediction, wind_speed, rated_power_mw=15.0)

    assert result.power_mw[0] == 15.0  # Clipped to rated
    assert result.power_mw[1] == 0.0   # Clipped to zero (was negative)
    assert result.power_mw[2] == 0.0   # Below cut-in → zero
    assert result.power_mw[3] == 0.0   # Above cut-out → zero

# Integration tests: API endpoint validation
async def test_load_flow_endpoint_returns_valid_voltages(client):
    """All bus voltages should be within 0.90-1.10 pu for normal scenarios."""
    response = await client.get("/api/v1/grid/load-flow/full_load")
    assert response.status_code == 200
    data = response.json()
    assert data["converged"] is True
    for bus in data["buses"]:
        assert 0.90 <= bus["vm_pu"] <= 1.10

# PtW state machine tests (services/p3/permit_to_work.py)
def test_ptw_cannot_skip_loto():
    """PtW must follow strict state machine — cannot go from APPROVED to ACTIVE."""
    permit = make_permit(status=PermitStatus.APPROVED)  # test helper around create_permit()
    allowed, _reason = validate_transition(permit, PermitStatus.ACTIVE, RoleLevel.ENGINEER)
    assert not allowed  # Must go through ISOLATION_CONFIRMED → LOTO_APPLIED first
```

Numbers in test docstrings must be hand-calculated (state the formula and units) — never
copy an "expected" value without recomputing it.

---

## Error Handling Patterns

Services raise domain exceptions from `backend/app/core/exceptions.py` — never `HTTPException`.
A global handler (registered in `main.py`) maps them to JSON responses:

```
DomainError               400   base class
├── NotFoundError         404   unknown bay / permit / programme id
├── ValidationError       422   physically invalid input (import as DomainValidationError
│                               in routers to avoid clashing with pydantic.ValidationError)
├── StateTransitionError  409   PtW / switching programme / bay interlock violation
└── PermissionDeniedError 403   RBAC level too low
```

```python
from app.core.exceptions import StateTransitionError

if not allowed:
    raise StateTransitionError(f"PtW {permit.ptw_number}: {current} → {target} not allowed ({reason})")
```

Add a new subclass only when it needs a different HTTP status; otherwise put the domain
detail (standard, limit, actual value with units) in the message.

---

## Documentation Standards

### Every Module Must Have

1. **Module-level docstring** explaining the engineering purpose
2. **Standards reference** (which IEC/IEEE standard does this implement?)
3. **Assumptions and limitations** clearly stated
4. **Units** documented for every engineering quantity

```python
"""
Grid Integration Module — HV Power System Analysis

Implements steady-state and quasi-dynamic power system analysis for a
510 MW offshore wind farm connected to the PSE transmission grid via
76.5 km 220 kV HVAC export cable.

Standards Implemented:
- IEC 60909-0:2016 — Short-circuit current calculation
- IEC 60287-1-1:2023 — Cable current rating
- PSE NC RfG requirements (2018) — FRT profile, fast fault current, LFSM/FSM, Q range; the 0.95–1.05 pu band is a planning criterion (NC RfG allows 0.90–1.118 pu at 110–300 kV)
- ENTSO-E RfG (EU 2016/631) — Type D generator requirements

Assumptions:
- Network modeled as balanced three-phase (positive sequence only)
- Grid represented as external grid with Ssc = 10 GVA at 400 kV PCC
- Transformer models use standard equivalent circuit (R + jX)
- Cable models use π-section equivalent

Limitations:
- Steady-state only — no transient/EMT simulation
- No harmonic impedance scan (requires frequency-dependent models)
- STATCOM modeled as ideal reactive power source (no converter dynamics)

Tools: Pandapower 3.x (BSD-3 license, IEC 60909 compliant)
"""
```

---

## Performance & Scalability Notes

- **PyWake:** Full 34-turbine wake analysis takes ~2-5 seconds. Cache results for repeated scenarios.
- **Pandapower:** Load flow converges in <100 ms for this network size. Short-circuit takes ~200 ms.
- **ML inference:** XGBoost prediction <10 ms, LSTM prediction ~50 ms, TFT prediction ~200 ms.
- **WebSocket:** SCADA simulation should push updates at 1 Hz (1 second intervals) to mimic real SCADA polling.
- **Database:** TimescaleDB hypertable for SCADA data. Enable compression for data older than 7 days. Continuous aggregates for hourly/daily rollups.

---

## Git Workflow

```
main          ← protected; every change lands via PR with the required `CI OK` check
├── feat/p2-load-flow
├── fix/voltage-calculation-bug
├── ci/shard-tests-automerge
└── dependabot/…   ← minor/patch auto-merge after CI OK; majors reviewed manually
```

**Commit message format** (Conventional Commits, always in English; scope = module):
```
feat(p2): add IEC 60909 short-circuit calculation with Pandapower

- Implement max and min fault current calculations
- Add bus results extraction with equipment margin check
- Include breaker rating validation against Ik'' results
- Add unit tests for OSS 220 kV and 66 kV busbars

Standards: IEC 60909-0:2016
```

---

## Security Checklist (IEC 62443 Alignment)

- [ ] All API endpoints require JWT authentication (except /health) — **planned**
- [x] RBAC simulation checks user level before executing control commands
- [x] All PtW state transitions logged with timestamp, user, and role level
- [ ] WebSocket connections authenticated before data streaming — **planned**
- [x] SQL injection prevention via SQLAlchemy ORM (only raw SQL: `SELECT 1` health check)
- [x] CORS restricted to configured origins (`settings.cors_origins`)
- [ ] Rate limiting on authentication endpoints — **planned (with JWT)**
- [x] Secrets managed via environment variables (never in code, `.env*` gitignored)
- [~] Docker containers run as non-root user — backend `appuser` ✓, frontend nginx still root
- [x] Dependencies scanned and pinned (Dependabot + `uv.lock` / `package-lock.json`)

---

*This SKILL.md defines the engineering and coding standards for the Offshore Wind HV Control Simulation Platform. Every developer (human or AI) working on this project must follow these conventions to ensure the codebase is professional, consistent, and educationally valuable.*

*Version 2.1 — September 2026 (examples re-verified against the codebase: PyWake 2.6, Pandapower 3.4)*
