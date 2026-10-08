"""
P2 HV Grid Integration API endpoints.

Provides REST endpoints for:
- Load flow analysis (Newton-Raphson via Pandapower)
- Short-circuit calculation (IEC 60909)
- STATCOM reactive power compensation sizing
- Fault ride-through against the PSE profile (phasor model)
- GFL vs GFM converter comparison
- Power Plant Controller (PPC) simulation and status
- Network specification constants

All endpoints follow the convention: /api/v1/grid/{resource}

Data approach: uses Pandapower for physics-based simulation
of the 510 MW offshore wind farm network (34 × 15 MW "V236 class" = IEA 15 MW,
66 kV array, 220 kV export, 400 kV PSE grid) — or of the learner's own farm
when the request carries the ``X-Farm`` header (routers/farm_spec.py).
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.core.cache import cached
from app.core.exceptions import DomainError
from app.core.exceptions import ValidationError as DomainValidationError
from app.routers.farm_spec import FarmSpecDep
from app.schemas.grid import (
    ConverterComparisonResponse,
    FRTSimulationResponse,
    FRTType,
    LiveLoadFlowRequest,
    LiveLoadFlowResponse,
    LoadFlowResponse,
    LoadFlowScenario,
    ShortCircuitResponse,
    STATCOMSizingResult,
)
from app.schemas.ppc import (
    ActivePowerMode,
    PPCSimulationRequest,
    PPCSimulationResponse,
    PPCStatusResponse,
    ReactivePowerMode,
    TSOSetpoint,
)
from app.services.p2.converter_comparison import SCENARIO_SSC_MVA, get_comparison_response
from app.services.p2.frt_simulation import run_frt_simulation
from app.services.p2.load_flow import run_all_scenarios, run_live_load_flow, run_load_flow
from app.services.p2.network_model import (
    MAX_TURBINES_PER_STRING,
    NUM_ONSHORE_TRANSFORMERS,
    NUM_OSS_TRANSFORMERS,
    SB510,
    FarmSpec,
)
from app.services.p2.power_plant_controller import get_ppc_status, run_ppc_simulation
from app.services.p2.short_circuit import calc_short_circuit
from app.services.p2.statcom_sizing import validate_compensation

router = APIRouter(prefix="/api/v1/grid", tags=["P2 HV Grid"])

# Phase B — M05 Protection Relay Coordination
from app.routers.p2_protection import router as _protection_router  # noqa: E402

router.include_router(_protection_router)

# Phase D — M06 Power Quality & Harmonics
from app.routers.p2_power_quality import router as _power_quality_router  # noqa: E402

router.include_router(_power_quality_router)

# Phase D — M08 BESS Integration
from app.routers.p2_bess import router as _bess_router  # noqa: E402

router.include_router(_bess_router)

# Phase E — M11 Market Integration
from app.routers.p2_market import router as _market_router  # noqa: E402

router.include_router(_market_router)

# Phase F — M10 Cable DTS Thermal Monitoring
from app.routers.p2_cable_dts import router as _cable_dts_router  # noqa: E402

router.include_router(_cable_dts_router)

# N-1 security of the export system
from app.routers.p2_security import router as _security_router  # noqa: E402

router.include_router(_security_router)

# Planning & P2X — export technology vs distance, electrolyser on surplus energy
from app.routers.p2_planning import router as _planning_router  # noqa: E402

router.include_router(_planning_router)


# ── Cached Helpers ───────────────────────────────────────────────


@cached(prefix="loadflow", ttl=300)
def _cached_load_flow(
    scenario: str, auto_dispatch: bool = True, spec: FarmSpec = SB510
) -> dict[str, object]:
    """Cached wrapper for load flow — returns Pydantic model as dict (the key holds the spec)."""
    result = run_load_flow(LoadFlowScenario(scenario), auto_dispatch=auto_dispatch, spec=spec)
    return result.model_dump()


# ── Pydantic Schemas ─────────────────────────────────────────────


class NetworkSpecResponse(BaseModel):
    """Electrical design of the modelled farm: SB-510, or the own project's ``design()``."""

    name: str
    source: str = Field(description="reference (SB-510) or project (X-Farm header)")
    total_capacity_mw: float
    num_turbines: int
    num_strings: int
    string_layout: list[int]
    section_a_strings: int = Field(description="Strings 1 … n on 66 kV busbar section A")
    max_turbines_per_string: int
    array_voltage_kv: float
    export_voltage_kv: float
    grid_voltage_kv: float
    array_cable_length_km: float
    export_length_km: float
    num_export_cables: int
    cable_q_mvar: float = Field(description="Charging power of all export circuits, ωCV²L")
    num_oss_transformers: int
    oss_trafo_mva: float
    num_onshore_transformers: int
    onshore_trafo_mva: float
    grid_ssc_mva: float
    statcom_rating_mvar: float
    num_reactors: int
    reactor_unit_mvar: float
    reactor_total_mvar: float


class FRTRequest(BaseModel):
    """Request for fault ride-through simulation."""

    fault_bus: str = Field(
        "PSE_400kV",
        description="Faulted bus: PSE_400kV, Onshore_220kV, OSS_220kV or OSS_66kV (LVRT)",
    )
    fault_impedance_pu: float = Field(
        0.005, ge=0.0, le=1.0, description="Fault impedance on 100 MVA base [p.u.], 0 = bolted"
    )
    fault_duration_s: float = Field(0.150, ge=0.050, le=1.0, description="Fault duration [s]")
    generation_fraction: float = Field(
        1.0, ge=0.0, le=1.0, description="Pre-fault generation level [0-1]"
    )
    k_factor: float = Field(2.0, ge=2.0, le=10.0, description="PSE fast fault current gain K")
    swell_pu: float = Field(1.20, ge=1.05, le=1.30, description="Grid voltage during HVRT [p.u.]")
    p_ramp_pu_s: float = Field(
        1.0, ge=0.1, le=10.0, description="Post-fault active power ramp [p.u./s]"
    )


# ── Endpoints ────────────────────────────────────────────────────


@router.get("/network-spec", response_model=NetworkSpecResponse)
async def get_network_spec(spec: FarmSpecDep) -> NetworkSpecResponse:
    """Electrical design of the modelled farm (SB-510 unless the X-Farm header is sent)."""
    return NetworkSpecResponse(
        name=spec.name,
        source="reference" if spec == SB510 else "project",
        total_capacity_mw=spec.capacity_mw,
        num_turbines=spec.num_turbines,
        num_strings=len(spec.string_layout),
        string_layout=list(spec.string_layout),
        section_a_strings=spec.section_a_strings,
        max_turbines_per_string=MAX_TURBINES_PER_STRING,
        array_voltage_kv=66.0,
        export_voltage_kv=220.0,
        grid_voltage_kv=400.0,
        array_cable_length_km=spec.array_cable_length_km,
        export_length_km=spec.export_length_km,
        num_export_cables=spec.num_export_cables,
        cable_q_mvar=round(spec.cable_q_mvar, 1),
        num_oss_transformers=NUM_OSS_TRANSFORMERS,
        oss_trafo_mva=spec.oss_trafo_mva,
        num_onshore_transformers=NUM_ONSHORE_TRANSFORMERS,
        onshore_trafo_mva=spec.onshore_trafo_mva,
        grid_ssc_mva=spec.grid_ssc_mva,
        statcom_rating_mvar=spec.statcom_mvar,
        num_reactors=spec.num_reactors,
        reactor_unit_mvar=spec.reactor_unit_mvar,
        reactor_total_mvar=spec.reactor_mvar,
    )


@router.get("/load-flow/{scenario}", response_model=LoadFlowResponse)
async def load_flow_scenario(scenario: LoadFlowScenario, spec: FarmSpecDep) -> LoadFlowResponse:
    """Run Newton-Raphson load flow for a single operating scenario.

    Scenarios: full_load, partial_load, no_load, n_minus_1.
    STATCOM auto-dispatch adjusts Q to maintain OSS voltage at 1.0 pu.
    Uses Redis cache (TTL 300s) to avoid recomputing identical requests.
    """
    try:
        result_dict = await _cached_load_flow(scenario.value, True, spec)
        return LoadFlowResponse(**result_dict)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Load flow analysis failed: {e}") from e


@router.post("/live-load-flow", response_model=LiveLoadFlowResponse)
async def live_load_flow(body: LiveLoadFlowRequest, spec: FarmSpecDep) -> LiveLoadFlowResponse:
    """Solve the grid for the live farm operating point (one power per WTG).

    Polled by the landing map every few seconds: the browser owns the farm
    simulation (wind, wakes, yaw, faults), the backend owns the network
    physics (pandapower Newton-Raphson + STATCOM auto-dispatch). Runs in a
    worker thread so the event loop stays free.
    """
    try:
        return await run_in_threadpool(run_live_load_flow, body.wtg_p_mw, spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Live load flow failed: {e}") from e


@router.get("/load-flow-all", response_model=list[LoadFlowResponse])
async def load_flow_all_scenarios(spec: FarmSpecDep) -> list[LoadFlowResponse]:
    """Run load flow for all four standard PSE IRiESP scenarios.

    Returns results for full_load, partial_load, no_load, and n_minus_1.
    """
    try:
        return run_all_scenarios(auto_dispatch=True, spec=spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Load flow analysis failed: {e}") from e


@router.get("/short-circuit/{case}", response_model=ShortCircuitResponse)
async def short_circuit(case: str, spec: FarmSpecDep) -> ShortCircuitResponse:
    """Run IEC 60909 short-circuit calculation at all buses.

    Case 'max' (c=1.1) for breaker sizing, 'min' (c=1.0) for protection
    sensitivity. Returns Ik'', ip, Sk'' per bus with breaker adequacy check.
    """
    if case not in ("max", "min"):
        raise DomainValidationError(f"Invalid case: '{case}'. Must be 'max' or 'min'.")
    try:
        return calc_short_circuit(case=case, spec=spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Short-circuit calculation failed: {e}") from e


@router.get("/statcom-sizing", response_model=STATCOMSizingResult)
async def statcom_sizing(spec: FarmSpecDep) -> STATCOMSizingResult:
    """Validate STATCOM and reactive power compensation sizing.

    Compares load flow with/without compensation to demonstrate
    Ferranti voltage rise and STATCOM necessity. Returns cable Q
    generation, reactor absorption, and compensation adequacy.
    """
    try:
        return await run_in_threadpool(validate_compensation, None, 10_000.0, spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"STATCOM sizing failed: {e}") from e


@router.post("/frt/{frt_type}", response_model=FRTSimulationResponse)
async def frt_simulation(
    frt_type: FRTType,
    request: FRTRequest,
    spec: FarmSpecDep,
) -> FRTSimulationResponse:
    """Fault ride-through screening (quasi-static phasor model, 5 ms steps).

    Checks against PSE's NC RfG requirements for a type-D power park module:
    - POC voltage vs the FRT profile (0 pu for 150 ms, then a ramp to 0.85 pu at 2.5 s)
    - Fast fault current ΔIq = K·ΔU (K 2–10), PSE Art. 20(2)(b)
    - Active power back to 90 % within 5 s of clearance, PSE Art. 20(3)(a)
    """
    try:
        return run_frt_simulation(
            frt_type=frt_type,
            fault_bus=request.fault_bus,
            fault_impedance_pu=request.fault_impedance_pu,
            fault_duration_s=request.fault_duration_s,
            generation_fraction=request.generation_fraction,
            k_factor=request.k_factor,
            swell_pu=request.swell_pu,
            p_ramp_pu_s=request.p_ramp_pu_s,
            spec=spec,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"FRT simulation failed: {e}") from e


@router.get(
    "/converter-comparison/{scenario}",
    response_model=ConverterComparisonResponse,
)
async def converter_comparison(
    scenario: str,
    spec: FarmSpecDep,
    phase_jump_deg: float = Query(20.0, ge=5.0, le=60.0, description="Grid phase jump [deg]"),
) -> ConverterComparisonResponse:
    """GFL vs GFM after a grid voltage phase jump (SMIB, 50 µs steps).

    Scenarios: strong_grid (10 GVA, SCR ≈ 19.6), weak_grid (2 GVA, SCR ≈ 3.9),
    very_weak_grid (0.7 GVA, SCR ≈ 1.4) — SCR at the PSE 400 kV POC.
    """
    if scenario not in SCENARIO_SSC_MVA:
        raise DomainValidationError(
            f"Invalid scenario: '{scenario}'. Must be one of {', '.join(SCENARIO_SSC_MVA)}."
        )
    return get_comparison_response(
        scenario=scenario,
        grid_ssc_mva=SCENARIO_SSC_MVA[scenario],
        phase_jump_deg=phase_jump_deg,
        spec=spec,
    )


# ── Power Plant Controller (PPC) ─────────────────────────────────


class PPCStatusRequest(BaseModel):
    """Request parameters for PPC status snapshot."""

    wind_speed_ms: float = Field(12.5, ge=0.0, le=50.0, description="Hub-height wind speed [m/s]")
    available_turbines: int | None = Field(
        None, ge=0, le=150, description="Online turbines; None = all of the farm's"
    )
    active_power_mode: ActivePowerMode = Field(
        ActivePowerMode.POWER_REFERENCE, description="Active power control mode"
    )
    reactive_power_mode: ReactivePowerMode = Field(
        ReactivePowerMode.VOLTAGE_CONTROL, description="Reactive power control mode"
    )
    frequency_hz: float = Field(50.0, ge=45.0, le=55.0, description="System frequency [Hz]")
    tso_setpoint: TSOSetpoint = Field(
        default_factory=TSOSetpoint, description="TSO dispatch command"
    )


@router.get("/ppc/status", response_model=PPCStatusResponse)
async def ppc_status_default(spec: FarmSpecDep) -> PPCStatusResponse:
    """Get PPC status at default operating conditions.

    Returns a real-time snapshot of the PPC state above rated wind (12 m/s; rated 10.66 m/s),
    all 34 turbines online, nominal frequency (50 Hz).
    """
    try:
        return get_ppc_status(spec=spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC status query failed: {e}") from e


@router.post("/ppc/status", response_model=PPCStatusResponse)
async def ppc_status(request: PPCStatusRequest, spec: FarmSpecDep) -> PPCStatusResponse:
    """Get PPC status at specified operating conditions.

    Returns a real-time snapshot of the PPC state for the given wind speed,
    turbine availability, control modes, and TSO setpoint. This represents
    what the SCADA HMI would display in real-time.
    """
    try:
        return get_ppc_status(
            wind_speed_ms=request.wind_speed_ms,
            available_turbines=request.available_turbines,
            tso_setpoint=request.tso_setpoint,
            active_power_mode=request.active_power_mode,
            reactive_power_mode=request.reactive_power_mode,
            frequency_hz=request.frequency_hz,
            spec=spec,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC status query failed: {e}") from e


@router.post("/ppc/simulate", response_model=PPCSimulationResponse)
async def ppc_simulate(request: PPCSimulationRequest, spec: FarmSpecDep) -> PPCSimulationResponse:
    """Run a PPC control simulation over a time window (0.1 s steps).

    TSO command at ``setpoint_time_s``; optional grid frequency step and grid
    voltage step at ``event_time_s``. Models the ramp-limited dispatch,
    LFSM-O/U and FSM on top of it, slope voltage control / Q / PF / Q(V) droop
    at the PSE 400 kV POC, and checks PSE's NC RfG requirements: set-point within
    2 % in 15 min, frequency response vs droop, 90 % of a Q change within 5 s.
    """
    try:
        return run_ppc_simulation(request, spec)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC simulation failed: {e}") from e
