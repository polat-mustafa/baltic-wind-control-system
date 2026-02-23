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
Auth:       JWT + RBAC (5 security levels per IEC 62443)
Container:  Docker + Docker Compose
CI/CD:      GitHub Actions
Testing:    pytest (backend) + Vitest (frontend) + Playwright (E2E)
Docs:       Auto-generated OpenAPI (Swagger) from FastAPI
```

### Monorepo Structure

```
offshore-wind-hv-platform/
├── backend/           # FastAPI Python service
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py        # Pydantic Settings
│   │   ├── database.py      # SQLAlchemy async engine
│   │   ├── auth/            # JWT + RBAC
│   │   ├── api/v1/          # REST endpoints per project
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response
│   │   ├── services/        # Business logic + computation
│   │   └── websocket/       # Real-time SCADA handlers
│   ├── tests/
│   ├── alembic/
│   └── pyproject.toml
├── frontend/          # React TypeScript SPA
│   ├── src/
│   │   ├── components/      # React components per project
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API client layer
│   │   ├── store/           # Zustand state management
│   │   └── types/           # TypeScript interfaces
│   ├── tests/
│   └── package.json
├── notebooks/         # Jupyter exploration notebooks
├── data/              # Reference data, SCL files, specs
├── docker-compose.yml
└── docs/
```

---

## Critical Domain Rules

### NEVER Violate These Engineering Principles

1. **Physical constraints are non-negotiable.** Power output MUST be ≥ 0 and ≤ Prated. Wind speed below cut-in or above cut-out means zero power. No exceptions. No ML model prediction overrides physics.

2. **Per-unit (pu) system must be consistent.** All voltage values in power system calculations use per-unit. Base voltage = nominal voltage of the bus. Base power = system MVA base (typically 100 MVA). NEVER mix absolute and per-unit values in the same calculation.

3. **IEC 60909 method for short-circuit.** Use the voltage factor c (cmax=1.1 for max, cmin=0.95 for min). Calculate Ik'' (initial symmetrical), ip (peak), Ib (breaking), and Ith (thermal). Pandapower handles this — do NOT implement from scratch.

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
    Calculate wake velocity deficit using Bastankhah-Porté-Agel (2014) model.
    
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
    Bastankhah, M. & Porté-Agel, F. (2014). J. Fluid Mech., 781, 706-730.
    """
    # Wake expansion rate (linear model)
    k_star = 0.3837 * turbulence_intensity + 0.003678
    
    # Characteristic wake width at x_downstream
    sigma = k_star * x_downstream + rotor_diameter / np.sqrt(8)
    
    # Maximum velocity deficit at wake center
    deficit = (1 - np.sqrt(1 - ct / (8 * (sigma / rotor_diameter) ** 2)))
    
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
power_mw: float = 500.0         # megawatts
reactive_power_mvar: float = 85.5  # megavolt-ampere reactive
current_ka: float = 18.3        # kiloamperes
frequency_hz: float = 50.0      # hertz
wind_speed_ms: float = 9.5      # meters per second
distance_km: float = 45.0       # kilometers
cable_capacitance_uf_per_km: float = 0.25  # microfarads per km

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

// Enum for well-defined states
enum TurbineStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  CURTAILED = 'curtailed',
}

// Enum for switching equipment states
enum SwitchPosition {
  OPEN = 'open',
  CLOSED = 'closed',
  INTERMEDIATE = 'intermediate',  // transitioning
  UNKNOWN = 'unknown',            // communication failure
}
```

**TypeScript standards:**
- Strict mode enabled (`"strict": true` in tsconfig)
- Interfaces for all API responses and domain objects
- Enums for all finite state sets
- No `any` type — use `unknown` if type is truly unknown
- React components: functional with hooks only, no class components
- Zustand for state management (lightweight, TypeScript-native)

### Safety-Critical Color Coding (IEC 61131 + ISA-101)

```typescript
// SCADA color palette — NEVER change these in the codebase
const SCADA_COLORS = {
  // Equipment states
  ENERGIZED: '#00FF00',     // Green — energized, normal operation
  DE_ENERGIZED: '#808080',  // Gray — de-energized, isolated
  EARTHED: '#00FFFF',       // Cyan — earthed (safety earth applied)
  FAULT: '#FF0000',         // Red — fault condition
  WARNING: '#FFAA00',       // Amber — warning, attention needed
  
  // Alarm priorities (per ISA-18.2 / EEMUA 191)
  ALARM_CRITICAL: '#FF0000',   // Red — immediate action required
  ALARM_HIGH: '#FF6600',       // Orange — prompt action required
  ALARM_MEDIUM: '#FFCC00',     // Yellow — awareness
  ALARM_LOW: '#00CCFF',        // Light blue — information
  
  // Voltage levels (standard power system colors)
  VOLTAGE_400KV: '#FF0000',    // Red
  VOLTAGE_220KV: '#0000FF',    // Blue
  VOLTAGE_66KV: '#008000',     // Green
  VOLTAGE_NEUTRAL: '#000000',  // Black
} as const;
```

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
# All endpoints follow: /api/v1/{project}/{resource}
# Example routes:

# P1: Wind Resource
GET    /api/v1/wind/farms                    # List wind farms
GET    /api/v1/wind/farms/{id}               # Get farm details
POST   /api/v1/wind/farms/{id}/wake-analysis # Run wake analysis
GET    /api/v1/wind/farms/{id}/aep           # Get AEP results

# P2: Grid Integration
GET    /api/v1/grid/networks/{id}            # Get network model
POST   /api/v1/grid/networks/{id}/load-flow  # Run load flow
POST   /api/v1/grid/networks/{id}/short-circuit  # Run IEC 60909
GET    /api/v1/grid/networks/{id}/frt-compliance  # FRT results

# P3: SCADA
GET    /api/v1/scada/equipment               # Equipment list
GET    /api/v1/scada/alarms                  # Active alarms
POST   /api/v1/scada/ptw                     # Create PtW
PATCH  /api/v1/scada/ptw/{id}/status         # Update PtW status
WS     /api/v1/scada/ws/live                 # WebSocket real-time

# P4: Forecasting
POST   /api/v1/forecast/run                  # Run forecast
GET    /api/v1/forecast/latest               # Latest forecast
GET    /api/v1/forecast/metrics              # Model performance

# P5: Commissioning
GET    /api/v1/commissioning/programmes      # List programmes
GET    /api/v1/commissioning/programmes/{id}/steps  # Get steps
PATCH  /api/v1/commissioning/steps/{id}/execute     # Execute step
```

### Pydantic Schema Examples

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum

class LoadFlowScenario(str, Enum):
    FULL_LOAD = "full_load"          # 500 MW
    PARTIAL_LOAD = "partial_load"    # 250 MW
    NO_LOAD = "no_load"              # 0 MW
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
    def pic_must_confirm(cls, v: bool, info) -> bool:
        # PiC confirmation is mandatory for all steps — never skip
        if not v:
            raise ValueError("Person in Control confirmation is MANDATORY. Cannot proceed without PiC GO decision.")
        return v
```

---

## Computation Engine Integration Patterns

### PyWake (P1)

```python
# ALWAYS use this pattern for PyWake integration
from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
from py_wake.superposition_models import LinearSum
from py_wake.turbulence_models import STF2017TurbulenceModel
from py_wake.site import XRSite
import xarray as xr

async def run_wake_analysis(farm_config: WindFarmConfig) -> WakeAnalysisResult:
    """Run wake analysis using PyWake BPA model."""
    
    # 1. Load site data (ERA5 preprocessed)
    site = XRSite(ds=xr.open_dataset(farm_config.site_data_path))
    
    # 2. Define turbine (V236-15.0 class)
    turbine = GenericWindTurbine(
        name='V236-15.0',
        diameter=236,
        hub_height=150,
        power_norm=15000,  # kW
        ct_func=ct_curve_interp,  # interpolated Ct curve
    )
    
    # 3. Configure wake model
    wf_model = BastankhahGaussianDeficit(
        site=site,
        windTurbines=turbine,
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
    )
    
    # 4. Run simulation
    sim_res = wf_model(
        x=farm_config.x_positions,
        y=farm_config.y_positions,
    )
    
    # 5. Extract results
    aep_gwh = float(sim_res.aep().sum()) / 1e6  # Convert from MWh to GWh
    wake_loss_pct = float(1 - sim_res.aep().sum() / sim_res.aep(with_wake_loss=False).sum()) * 100
    
    return WakeAnalysisResult(
        aep_gwh=aep_gwh,
        wake_loss_percent=wake_loss_pct,
        per_turbine_aep=sim_res.aep().values.tolist(),
    )
```

### Pandapower (P2)

```python
# ALWAYS validate network before running calculations
import pandapower as pp
import pandapower.shortcircuit as sc

async def run_load_flow(scenario: LoadFlowScenario) -> LoadFlowResponse:
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

async def run_short_circuit_iec60909(net) -> ShortCircuitResult:
    """Run IEC 60909 short-circuit calculation."""
    
    # Max short-circuit (for equipment rating)
    sc.calc_sc(net, case='max', ith=True, ip=True, 
               branch_results=True, method='complete')
    
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
    """BPA wake deficit at 8D downstream should be approximately 15-25%."""
    deficit = calculate_wake_deficit(
        x_downstream=8 * 236,  # 8 rotor diameters
        rotor_diameter=236,
        ct=0.28,
        turbulence_intensity=0.06,
    )
    assert 0.10 < deficit < 0.30, f"Wake deficit {deficit:.3f} outside expected range"

def test_cable_reactive_power():
    """45 km 220 kV XLPE cable should generate approximately 85 MVAR."""
    q_mvar = calculate_cable_reactive_power(
        omega=2 * np.pi * 50,
        capacitance_uf_per_km=0.25,
        voltage_kv=220,
        length_km=45,
    )
    assert 80 < q_mvar < 95, f"Cable Q={q_mvar:.1f} MVAR outside expected range"

def test_physical_constraints_enforcement():
    """ML prediction must be clipped to physical limits."""
    raw_prediction = np.array([16.0, -2.0, 5.0, 0.5])
    wind_speed = np.array([15.0, 8.0, 2.0, 35.0])  # 2.0 = below cut-in, 35.0 = above cut-out
    
    result = enforce_physical_constraints(raw_prediction, wind_speed, rated_power=15.0)
    
    assert result[0] == 15.0  # Clipped to rated
    assert result[1] == 0.0   # Clipped to zero (was negative)
    assert result[2] == 0.0   # Below cut-in → zero
    assert result[3] == 0.0   # Above cut-out → zero

# Integration tests: API endpoint validation
async def test_load_flow_endpoint_returns_valid_voltages(client):
    """All bus voltages should be within 0.90-1.10 pu for normal scenarios."""
    response = await client.post("/api/v1/grid/networks/1/load-flow", json={
        "scenario": "full_load",
        "wind_power_mw": 500.0,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["converged"] is True
    for bus in data["buses"]:
        assert 0.90 <= bus["voltage_pu"] <= 1.10

# PtW state machine tests
def test_ptw_cannot_skip_loto():
    """PtW must follow strict state machine — cannot go from APPROVED to ACTIVE."""
    ptw = PermitToWork(status="APPROVED")
    with pytest.raises(InvalidStateTransition):
        ptw.transition_to("ACTIVE")  # Must go through ISOLATION_CONFIRMED → LOTO_APPLIED first
```

---

## Error Handling Patterns

```python
# Domain-specific exceptions
class OffshoreWindError(Exception):
    """Base exception for all domain errors."""
    pass

class GridCodeViolation(OffshoreWindError):
    """Raised when simulation results violate grid code requirements."""
    def __init__(self, standard: str, requirement: str, actual: float, limit: float):
        self.standard = standard
        self.requirement = requirement
        self.actual = actual
        self.limit = limit
        super().__init__(
            f"Grid code violation: {standard} - {requirement}. "
            f"Actual: {actual:.3f}, Limit: {limit:.3f}"
        )

class ProtectionMiscoordination(OffshoreWindError):
    """Raised when protection relay settings are non-selective."""
    pass

class InvalidSwitchingSequence(OffshoreWindError):
    """Raised when switching programme step precondition is not met."""
    pass

class PtWViolation(OffshoreWindError):
    """Raised when PtW state machine transition is invalid."""
    pass
```

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
500 MW offshore wind farm connected to the PSE transmission grid via
45 km 220 kV HVAC export cable.

Standards Implemented:
- IEC 60909-0:2016 — Short-circuit current calculation
- IEC 60287-1-1:2023 — Cable current rating
- PSE IRiESP — Polish grid code voltage limits (±5% of nominal)
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

Tools: Pandapower v2.x (BSD-3 license, IEC 60909 compliant)
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
main          ← production-ready, tagged releases
├── develop   ← integration branch, all features merge here
│   ├── feature/p1-wake-model
│   ├── feature/p2-load-flow
│   ├── feature/p3-scada-goose
│   ├── feature/p4-xgboost-model
│   ├── feature/p5-switching-programme
│   └── fix/voltage-calculation-bug
```

**Commit message format:**
```
[P2] Add IEC 60909 short-circuit calculation with Pandapower

- Implement max and min fault current calculations
- Add bus results extraction with equipment margin check
- Include breaker rating validation against Ik'' results
- Add unit tests for OSS 220 kV and 66 kV busbars

Standards: IEC 60909-0:2016
```

---

## Security Checklist (IEC 62443 Alignment)

- [ ] All API endpoints require JWT authentication (except /health)
- [ ] RBAC middleware checks user level before executing control commands
- [ ] All PtW state transitions logged with timestamp, user, and IP
- [ ] WebSocket connections authenticated before data streaming
- [ ] SQL injection prevention via SQLAlchemy ORM (never raw SQL)
- [ ] CORS restricted to specific frontend origin
- [ ] Rate limiting on authentication endpoints
- [ ] Secrets managed via environment variables (never in code)
- [ ] Docker containers run as non-root user
- [ ] Dependencies scanned for vulnerabilities (GitHub Dependabot)

---

*This SKILL.md defines the engineering and coding standards for the Offshore Wind HV Control Simulation Platform. Every developer (human or AI) working on this project must follow these conventions to ensure the codebase is professional, consistent, and educationally valuable.*

*Version 2.0 — February 2026*
