"""
P2 HV Grid Integration API endpoints.

Provides REST endpoints for:
- Load flow analysis (Newton-Raphson via Pandapower)
- Short-circuit calculation (IEC 60909)
- STATCOM reactive power compensation sizing
- Fault ride-through simulation (ANDES TDS)
- GFL vs GFM converter comparison
- Power Plant Controller (PPC) simulation and status
- Network specification constants

All endpoints follow the convention: /api/v1/grid/{resource}

Data approach: uses Pandapower + ANDES for physics-based simulation
of the 510 MW offshore wind farm network (34 × V236-15.0 MW,
66 kV array, 220 kV export, 400 kV PSE grid).
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.cache import cached
from app.core.exceptions import DomainError
from app.core.exceptions import ValidationError as DomainValidationError
from app.schemas.grid import (
    ConverterComparisonResponse,
    DynamicComplianceResponse,
    FrequencyMode,
    FrequencyResponseResponse,
    FRTSimulationResponse,
    FRTType,
    LoadFlowResponse,
    LoadFlowScenario,
    ShortCircuitResponse,
    SSOScreeningResponse,
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
from app.services.p2.converter_comparison import get_comparison_response
from app.services.p2.dynamic_compliance import run_full_compliance_assessment
from app.services.p2.frequency_response import run_frequency_response
from app.services.p2.frt_simulation import run_frt_simulation
from app.services.p2.load_flow import run_all_scenarios, run_load_flow
from app.services.p2.network_model import (
    EXPORT_CABLE_LENGTH_KM,
    GRID_SSC_MVA,
    NUM_TURBINES,
    STATCOM_RATING_MVAR,
    STRING_LAYOUT,
    TOTAL_CAPACITY_MW,
)
from app.services.p2.power_plant_controller import get_ppc_status, run_ppc_simulation
from app.services.p2.short_circuit import calc_short_circuit
from app.services.p2.sso_analysis import run_sso_screening
from app.services.p2.optimal_power_flow import run_ac_opf, run_dc_opf
from app.services.p2.scopf import run_scopf
from app.services.p2.dc_power_flow import (
    run_dc_power_flow,
    run_dc_contingency_screening,
)
from app.services.p2.economic_dispatch import (
    generate_wind_forecast,
    run_economic_dispatch,
)
from app.services.p2.energy_storage import run_bess_dispatch
from app.services.p2.ac_dc_network import compare_export_options
from app.services.p2.capacity_expansion import plan_capacity_expansion
from app.services.p2.statcom_sizing import validate_compensation

router = APIRouter(prefix="/api/v1/grid", tags=["P2 HV Grid"])


# ── Cached Helpers ───────────────────────────────────────────────


@cached(prefix="loadflow", ttl=300)
def _cached_load_flow(scenario: str, auto_dispatch: bool = True) -> dict[str, object]:
    """Cached wrapper for load flow — returns Pydantic model as dict."""
    result = run_load_flow(LoadFlowScenario(scenario), auto_dispatch=auto_dispatch)
    return result.model_dump()


# ── Pydantic Schemas ─────────────────────────────────────────────


class NetworkSpecResponse(BaseModel):
    """510 MW offshore wind farm network specification constants."""

    total_capacity_mw: float
    num_turbines: int
    num_strings: int
    string_layout: list[int]
    array_voltage_kv: float
    export_voltage_kv: float
    grid_voltage_kv: float
    export_length_km: float
    grid_ssc_mva: float
    statcom_rating_mvar: float


class FRTRequest(BaseModel):
    """Request for fault ride-through simulation."""

    fault_bus: str = Field("OSS_66kV", description="Bus name where fault is applied")
    fault_impedance_pu: float = Field(0.05, ge=0.001, le=1.0, description="Fault impedance [p.u.]")
    fault_duration_s: float = Field(0.150, ge=0.050, le=1.0, description="Fault duration [s]")
    generation_fraction: float = Field(
        1.0, ge=0.0, le=1.0, description="Pre-fault generation level [0-1]"
    )


class DynamicComplianceRequest(BaseModel):
    """Request for full NC RfG Type D dynamic compliance assessment."""

    export_length_km: float = Field(
        EXPORT_CABLE_LENGTH_KM, ge=1.0, le=200.0, description="Export cable length [km]"
    )
    grid_ssc_mva: float = Field(
        GRID_SSC_MVA, ge=500.0, le=50_000.0, description="Grid short-circuit capacity [MVA]"
    )
    generation_fraction: float = Field(
        1.0, ge=0.0, le=1.0, description="Pre-fault generation level [0-1]"
    )


class FrequencyResponseRequest(BaseModel):
    """Request for frequency response simulation."""

    mode: FrequencyMode = Field(description="NC RfG frequency response mode")
    freq_step_hz: float = Field(0.5, ge=0.01, le=2.0, description="Frequency step [Hz]")
    droop_pct: float = Field(5.0, ge=1.0, le=12.0, description="Droop percentage [%]")
    generation_fraction: float = Field(
        0.8, ge=0.0, le=1.0, description="Pre-event generation level [0-1]"
    )


class SSOScreeningRequest(BaseModel):
    """Request for sub-synchronous oscillation screening."""

    export_length_km: float = Field(
        EXPORT_CABLE_LENGTH_KM, ge=1.0, le=200.0, description="Export cable length [km]"
    )
    grid_ssc_mva: float = Field(
        GRID_SSC_MVA, ge=500.0, le=50_000.0, description="Grid short-circuit capacity [MVA]"
    )
    generation_fraction: float = Field(1.0, ge=0.0, le=1.0, description="Generation level [0-1]")


# ── Endpoints ────────────────────────────────────────────────────


@router.get("/network-spec", response_model=NetworkSpecResponse)
async def get_network_spec() -> NetworkSpecResponse:
    """Return 510 MW offshore wind farm network specification constants."""
    return NetworkSpecResponse(
        total_capacity_mw=TOTAL_CAPACITY_MW,
        num_turbines=34,
        num_strings=len(STRING_LAYOUT),
        string_layout=list(STRING_LAYOUT),
        array_voltage_kv=66.0,
        export_voltage_kv=220.0,
        grid_voltage_kv=400.0,
        export_length_km=EXPORT_CABLE_LENGTH_KM,
        grid_ssc_mva=GRID_SSC_MVA,
        statcom_rating_mvar=STATCOM_RATING_MVAR,
    )


@router.get("/load-flow/{scenario}", response_model=LoadFlowResponse)
async def load_flow_scenario(scenario: LoadFlowScenario) -> LoadFlowResponse:
    """Run Newton-Raphson load flow for a single operating scenario.

    Scenarios: full_load, partial_load, no_load, n_minus_1.
    STATCOM auto-dispatch adjusts Q to maintain OSS voltage at 1.0 pu.
    Uses Redis cache (TTL 300s) to avoid recomputing identical requests.
    """
    try:
        result_dict = await _cached_load_flow(scenario.value)
        return LoadFlowResponse(**result_dict)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Load flow analysis failed: {e}") from e


@router.get("/load-flow-all", response_model=list[LoadFlowResponse])
async def load_flow_all_scenarios() -> list[LoadFlowResponse]:
    """Run load flow for all four standard PSE IRiESP scenarios.

    Returns results for full_load, partial_load, no_load, and n_minus_1.
    """
    try:
        return run_all_scenarios(auto_dispatch=True)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Load flow analysis failed: {e}") from e


@router.get("/short-circuit/{case}", response_model=ShortCircuitResponse)
async def short_circuit(case: str) -> ShortCircuitResponse:
    """Run IEC 60909 short-circuit calculation at all buses.

    Case 'max' (c=1.1) for breaker sizing, 'min' (c=1.0) for protection
    sensitivity. Returns Ik'', ip, Sk'' per bus with breaker adequacy check.
    """
    if case not in ("max", "min"):
        raise DomainValidationError(f"Invalid case: '{case}'. Must be 'max' or 'min'.")
    try:
        return calc_short_circuit(case=case)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Short-circuit calculation failed: {e}") from e


@router.get("/statcom-sizing", response_model=STATCOMSizingResult)
async def statcom_sizing() -> STATCOMSizingResult:
    """Validate STATCOM and reactive power compensation sizing.

    Compares load flow with/without compensation to demonstrate
    Ferranti voltage rise and STATCOM necessity. Returns cable Q
    generation, reactor absorption, and compensation adequacy.
    """
    try:
        return validate_compensation()
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"STATCOM sizing failed: {e}") from e


@router.post("/frt/{frt_type}", response_model=FRTSimulationResponse)
async def frt_simulation(
    frt_type: FRTType,
    request: FRTRequest,
) -> FRTSimulationResponse:
    """Run fault ride-through simulation using ANDES TDS.

    Applies a fault at the specified bus and checks NC RfG compliance:
    - WTGs stay connected within PSE LVRT/HVRT voltage-time envelope
    - Reactive current injection: Kqv >= 2.0 per NC RfG Article 21
    - Active power recovery: >= 90% within 1.0 s after clearance
    """
    try:
        return run_frt_simulation(
            frt_type=frt_type,
            fault_bus=request.fault_bus,
            fault_impedance_pu=request.fault_impedance_pu,
            fault_duration_s=request.fault_duration_s,
            generation_fraction=request.generation_fraction,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"FRT simulation failed: {e}") from e


@router.get(
    "/converter-comparison/{scenario}",
    response_model=ConverterComparisonResponse,
)
async def converter_comparison(scenario: str) -> ConverterComparisonResponse:
    """Compare GFL vs GFM converter response at given grid strength.

    Scenario 'strong_grid' (SCR ~19.6) or 'weak_grid' (SCR ~3.9).
    Shows stability differences and educational GFM advantage summary.
    """
    if scenario == "strong_grid":
        grid_ssc = GRID_SSC_MVA
    elif scenario == "weak_grid":
        grid_ssc = 2_000.0
    else:
        raise DomainValidationError(
            f"Invalid scenario: '{scenario}'. Must be 'strong_grid' or 'weak_grid'."
        )
    try:
        return get_comparison_response(scenario=scenario, grid_ssc_mva=grid_ssc)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Converter comparison failed: {e}") from e


# ── Dynamic Compliance (P2B) ────────────────────────────────────


@router.post("/dynamic-compliance", response_model=DynamicComplianceResponse)
async def dynamic_compliance(
    request: DynamicComplianceRequest,
) -> DynamicComplianceResponse:
    """Run full NC RfG Type D dynamic compliance assessment.

    Aggregates LVRT, HVRT, LFSM-O, LFSM-U, FSM, RoCoF, SSO, and
    converter comparison into a single compliance verdict.
    """
    try:
        return run_full_compliance_assessment(
            export_length_km=request.export_length_km,
            grid_ssc_mva=request.grid_ssc_mva,
            generation_fraction=request.generation_fraction,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Dynamic compliance assessment failed: {e}") from e


@router.post("/frequency-response", response_model=FrequencyResponseResponse)
async def frequency_response(
    request: FrequencyResponseRequest,
) -> FrequencyResponseResponse:
    """Run NC RfG frequency response simulation for a single mode.

    Modes: LFSM-O (over-frequency), LFSM-U (under-frequency),
    FSM (frequency-sensitive mode).
    """
    try:
        return run_frequency_response(
            mode=request.mode,
            freq_step_hz=request.freq_step_hz,
            droop_pct=request.droop_pct,
            generation_fraction=request.generation_fraction,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Frequency response simulation failed: {e}") from e


@router.post("/sso-analysis", response_model=SSOScreeningResponse)
async def sso_analysis(
    request: SSOScreeningRequest,
) -> SSOScreeningResponse:
    """Run sub-synchronous oscillation screening analysis.

    Checks cable resonance frequency, impedance scan, and eigenvalue
    stability for Type 4 WTG interactions with long export cables.
    """
    try:
        return run_sso_screening(
            export_length_km=request.export_length_km,
            grid_ssc_mva=request.grid_ssc_mva,
            generation_fraction=request.generation_fraction,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"SSO analysis failed: {e}") from e


@router.get("/andes-network", response_model=NetworkSpecResponse)
async def get_andes_network() -> NetworkSpecResponse:
    """Return ANDES dynamic network specification.

    Same network constants as the Pandapower model, confirming
    consistency between steady-state and dynamic simulation tools.
    """
    return NetworkSpecResponse(
        total_capacity_mw=TOTAL_CAPACITY_MW,
        num_turbines=34,
        num_strings=len(STRING_LAYOUT),
        string_layout=list(STRING_LAYOUT),
        array_voltage_kv=66.0,
        export_voltage_kv=220.0,
        grid_voltage_kv=400.0,
        export_length_km=EXPORT_CABLE_LENGTH_KM,
        grid_ssc_mva=GRID_SSC_MVA,
        statcom_rating_mvar=STATCOM_RATING_MVAR,
    )


# ── Power Plant Controller (PPC) ─────────────────────────────────


class PPCStatusRequest(BaseModel):
    """Request parameters for PPC status snapshot."""

    wind_speed_ms: float = Field(12.5, ge=0.0, le=50.0, description="Hub-height wind speed [m/s]")
    available_turbines: int = Field(
        NUM_TURBINES, ge=0, le=NUM_TURBINES, description="Number of online turbines"
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
async def ppc_status_default() -> PPCStatusResponse:
    """Get PPC status at default operating conditions.

    Returns a real-time snapshot of the PPC state at rated wind (12.5 m/s),
    all 34 turbines online, nominal frequency (50 Hz).
    """
    try:
        return get_ppc_status()
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC status query failed: {e}") from e


@router.post("/ppc/status", response_model=PPCStatusResponse)
async def ppc_status(request: PPCStatusRequest) -> PPCStatusResponse:
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
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC status query failed: {e}") from e


@router.post("/ppc/simulate", response_model=PPCSimulationResponse)
async def ppc_simulate(request: PPCSimulationRequest) -> PPCSimulationResponse:
    """Run a PPC control simulation over a time window.

    Simulates the full PPC control loop: TSO dispatch → ramp rate limiter →
    pro-rata WTG dispatch → voltage/reactive power control → compliance check.

    The simulation models:
    - Active power ramp rate limiting (PSE IRiESP: 10% Pn/min up, 20% Pn/min down)
    - Pro-rata power dispatch to 34 WTGs
    - Voltage PI control, direct Q, power factor, or Q(V) droop mode
    - STATCOM / WTG reactive power coordination
    - Frequency response integration (LFSM-O/U/FSM)
    - Emergency stop (2% Pn/s = 10.2 MW/s)
    - PSE compliance verdicts (setpoint accuracy ±5%, ramp rates, voltage 0.95-1.05 pu)
    """
    try:
        return run_ppc_simulation(request)
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"PPC simulation failed: {e}") from e


# ── Optimal Power Flow (OPF) ────────────────────────────────────


class OPFRequest(BaseModel):
    """Request for Optimal Power Flow analysis."""

    method: str = Field("ac", description="OPF method: 'ac' (nonlinear) or 'dc' (linearized)")
    generation_fraction: float = Field(
        1.0, ge=0.0, le=1.0, description="Available generation fraction [0-1]"
    )
    export_length_km: float = Field(
        EXPORT_CABLE_LENGTH_KM, ge=1.0, le=200.0, description="Export cable length [km]"
    )
    grid_ssc_mva: float = Field(
        GRID_SSC_MVA, ge=500.0, le=50_000.0, description="Grid short-circuit capacity [MVA]"
    )


class GeneratorDispatchSchema(BaseModel):
    """OPF dispatch result for a single generator."""

    name: str
    p_mw: float
    q_mvar: float
    p_max_mw: float
    curtailed_mw: float
    marginal_cost_eur_mwh: float


class OPFResponse(BaseModel):
    """Optimal Power Flow result."""

    converged: bool
    method: str
    objective_value_eur_h: float
    total_generation_mw: float
    total_curtailment_mw: float
    curtailment_percent: float
    total_loss_mw: float
    v_min_pu: float
    v_max_pu: float
    voltage_compliant: bool
    max_line_loading_percent: float
    max_trafo_loading_percent: float
    generators: list[GeneratorDispatchSchema]
    statcom_q_mvar: float
    cost_saving_vs_curtailment_eur_h: float


class SCOPFRequest(BaseModel):
    """Request for Security-Constrained OPF analysis."""

    generation_fraction: float = Field(
        1.0, ge=0.0, le=1.0, description="Available generation fraction [0-1]"
    )
    export_length_km: float = Field(
        EXPORT_CABLE_LENGTH_KM, ge=1.0, le=200.0, description="Export cable length [km]"
    )
    grid_ssc_mva: float = Field(
        GRID_SSC_MVA, ge=500.0, le=50_000.0, description="Grid short-circuit capacity [MVA]"
    )


class ContingencyViolationSchema(BaseModel):
    """A constraint violation in a post-contingency state."""

    contingency_name: str
    violation_type: str
    element_name: str
    value: float
    limit: float
    severity: float


class ContingencyResultSchema(BaseModel):
    """Post-contingency analysis result for a single N-1 scenario."""

    name: str
    description: str
    converged: bool
    v_min_pu: float
    v_max_pu: float
    max_line_loading_percent: float
    max_trafo_loading_percent: float
    violations: list[ContingencyViolationSchema]
    secure: bool


class SCOPFResponse(BaseModel):
    """Security-Constrained OPF result."""

    base_case: OPFResponse
    contingency_results: list[ContingencyResultSchema]
    n1_secure: bool
    num_violations: int
    worst_contingency: str
    iterations: int
    total_curtailment_for_security_mw: float


@router.post("/opf", response_model=OPFResponse)
async def optimal_power_flow(request: OPFRequest) -> OPFResponse:
    """Run Optimal Power Flow to find least-cost dispatch.

    Minimizes curtailment cost while respecting voltage limits (0.95-1.05 pu),
    cable thermal limits, and transformer loading limits. AC OPF uses interior
    point method; DC OPF uses linearized power flow for fast screening.

    Physics: min Σ c_i × P_i subject to power balance + network constraints.
    """
    try:
        if request.method == "dc":
            result = run_dc_opf(
                generation_fraction=request.generation_fraction,
                export_length_km=request.export_length_km,
                grid_ssc_mva=request.grid_ssc_mva,
            )
        else:
            result = run_ac_opf(
                generation_fraction=request.generation_fraction,
                export_length_km=request.export_length_km,
                grid_ssc_mva=request.grid_ssc_mva,
            )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"OPF analysis failed: {e}") from e

    return OPFResponse(
        converged=result.converged,
        method=result.method,
        objective_value_eur_h=result.objective_value_eur_h,
        total_generation_mw=result.total_generation_mw,
        total_curtailment_mw=result.total_curtailment_mw,
        curtailment_percent=result.curtailment_percent,
        total_loss_mw=result.total_loss_mw,
        v_min_pu=result.v_min_pu,
        v_max_pu=result.v_max_pu,
        voltage_compliant=result.voltage_compliant,
        max_line_loading_percent=result.max_line_loading_percent,
        max_trafo_loading_percent=result.max_trafo_loading_percent,
        generators=[
            GeneratorDispatchSchema(
                name=g.name, p_mw=g.p_mw, q_mvar=g.q_mvar,
                p_max_mw=g.p_max_mw, curtailed_mw=g.curtailed_mw,
                marginal_cost_eur_mwh=g.marginal_cost_eur_mwh,
            )
            for g in result.generators
        ],
        statcom_q_mvar=result.statcom_q_mvar,
        cost_saving_vs_curtailment_eur_h=result.cost_saving_vs_curtailment_eur_h,
    )


@router.post("/scopf", response_model=SCOPFResponse)
async def security_constrained_opf(request: SCOPFRequest) -> SCOPFResponse:
    """Run Security-Constrained OPF with N-1 contingency analysis.

    Solves AC OPF, then checks all 7 string outage contingencies. If any
    post-contingency state violates voltage or thermal limits, reduces
    generation and re-solves until N-1 security is achieved.

    Physics: Same as OPF + ∀ contingency k: constraints remain feasible.
    """
    try:
        result = run_scopf(
            generation_fraction=request.generation_fraction,
            export_length_km=request.export_length_km,
            grid_ssc_mva=request.grid_ssc_mva,
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"SCOPF analysis failed: {e}") from e

    base_resp = OPFResponse(
        converged=result.base_case.converged,
        method=result.base_case.method,
        objective_value_eur_h=result.base_case.objective_value_eur_h,
        total_generation_mw=result.base_case.total_generation_mw,
        total_curtailment_mw=result.base_case.total_curtailment_mw,
        curtailment_percent=result.base_case.curtailment_percent,
        total_loss_mw=result.base_case.total_loss_mw,
        v_min_pu=result.base_case.v_min_pu,
        v_max_pu=result.base_case.v_max_pu,
        voltage_compliant=result.base_case.voltage_compliant,
        max_line_loading_percent=result.base_case.max_line_loading_percent,
        max_trafo_loading_percent=result.base_case.max_trafo_loading_percent,
        generators=[
            GeneratorDispatchSchema(
                name=g.name, p_mw=g.p_mw, q_mvar=g.q_mvar,
                p_max_mw=g.p_max_mw, curtailed_mw=g.curtailed_mw,
                marginal_cost_eur_mwh=g.marginal_cost_eur_mwh,
            )
            for g in result.base_case.generators
        ],
        statcom_q_mvar=result.base_case.statcom_q_mvar,
        cost_saving_vs_curtailment_eur_h=result.base_case.cost_saving_vs_curtailment_eur_h,
    )

    cont_results = [
        ContingencyResultSchema(
            name=c.name, description=c.description, converged=c.converged,
            v_min_pu=c.v_min_pu, v_max_pu=c.v_max_pu,
            max_line_loading_percent=c.max_line_loading_percent,
            max_trafo_loading_percent=c.max_trafo_loading_percent,
            violations=[
                ContingencyViolationSchema(
                    contingency_name=v.contingency_name,
                    violation_type=v.violation_type,
                    element_name=v.element_name,
                    value=v.value, limit=v.limit, severity=v.severity,
                )
                for v in c.violations
            ],
            secure=c.secure,
        )
        for c in result.contingency_results
    ]

    return SCOPFResponse(
        base_case=base_resp,
        contingency_results=cont_results,
        n1_secure=result.n1_secure,
        num_violations=result.num_violations,
        worst_contingency=result.worst_contingency,
        iterations=result.iterations,
        total_curtailment_for_security_mw=result.total_curtailment_for_security_mw,
    )


# ── Tier 2 Schemas ────────────────────────────────────────────


class DCPowerFlowRequest(BaseModel):
    """Request for DC (linearized) power flow."""

    generation_fraction: float = Field(1.0, ge=0.0, le=1.0)
    export_length_km: float = Field(EXPORT_CABLE_LENGTH_KM, ge=1.0, le=200.0)
    grid_ssc_mva: float = Field(GRID_SSC_MVA, ge=500.0, le=50_000.0)


class DCLineResultSchema(BaseModel):
    name: str
    p_from_mw: float
    loading_percent: float
    overloaded: bool


class DCPowerFlowResponse(BaseModel):
    converged: bool
    total_generation_mw: float
    total_export_mw: float
    max_line_loading_percent: float
    num_overloaded_lines: int
    line_results: list[DCLineResultSchema]


class DCContingencyResponse(BaseModel):
    n_contingencies: int
    n_secure: int
    n_violations: int
    worst_contingency: str
    worst_loading_percent: float


class EconomicDispatchRequest(BaseModel):
    mean_wind_speed_ms: float = Field(10.5, ge=5.0, le=20.0)
    curtailment_order_mw: float = Field(0.0, ge=0.0, le=510.0)
    electricity_price_eur_mwh: float = Field(72.0, ge=10.0, le=300.0)


class DispatchTimestepSchema(BaseModel):
    hour: int
    wind_power_available_mw: float
    wind_power_dispatched_mw: float
    curtailed_mw: float
    ramp_rate_mw_min: float
    ramp_compliant: bool
    cost_eur: float


class EconomicDispatchResponse(BaseModel):
    total_generation_mwh: float
    total_curtailment_mwh: float
    total_cost_eur: float
    curtailment_cost_eur: float
    average_cost_eur_mwh: float
    max_ramp_mw_min: float
    ramp_violations: int
    capacity_factor: float
    timesteps: list[DispatchTimestepSchema]


class BESSRequest(BaseModel):
    mean_wind_speed_ms: float = Field(10.5, ge=5.0, le=20.0)
    grid_export_limit_mw: float = Field(510.0, ge=100.0, le=1000.0)
    bess_power_mw: float = Field(100.0, ge=10.0, le=500.0)
    bess_energy_mwh: float = Field(400.0, ge=40.0, le=2000.0)


class BESSTimestepSchema(BaseModel):
    hour: int
    wind_power_mw: float
    bess_power_mw: float
    grid_export_mw: float
    soc: float
    curtailed_mw: float
    revenue_eur: float


class BESSResponse(BaseModel):
    total_revenue_eur: float
    revenue_without_bess_eur: float
    revenue_gain_eur: float
    revenue_gain_percent: float
    curtailment_without_bess_mwh: float
    curtailment_with_bess_mwh: float
    curtailment_reduction_mwh: float
    bess_cycles: float
    average_soc: float
    timesteps: list[BESSTimestepSchema]


class ACDCComparisonRequest(BaseModel):
    cable_length_km: float = Field(45.0, ge=1.0, le=300.0)
    capacity_factor: float = Field(0.45, ge=0.1, le=0.7)


class ExportOptionSchema(BaseModel):
    technology: str
    total_loss_mw: float
    loss_percent: float
    cable_loss_mw: float
    converter_loss_mw: float
    reactive_compensation_mvar: float
    annual_loss_gwh: float
    capex_index: float


class ACDCComparisonResponse(BaseModel):
    options: list[ExportOptionSchema]
    recommended: str
    recommendation_reason: str
    loss_saving_mw: float
    loss_saving_gwh_year: float


class CapacityExpansionRequest(BaseModel):
    electricity_price_eur_mwh: float = Field(72.0, ge=10.0, le=300.0)
    base_year: int = Field(2026, ge=2024, le=2035)
    include_bess: bool = Field(True)


class ProjectPhaseSchema(BaseModel):
    name: str
    capacity_mw: float
    build_year: int
    cod_year: int
    capex_meur: float
    annual_aep_gwh: float
    lcoe_eur_mwh: float
    npv_meur: float
    irr_percent: float
    bess_mwh: float


class CapacityExpansionResponse(BaseModel):
    phases: list[ProjectPhaseSchema]
    total_capacity_mw: float
    total_capex_meur: float
    total_annual_aep_gwh: float
    portfolio_lcoe_eur_mwh: float
    portfolio_npv_meur: float
    buildout_years: int
    total_bess_mwh: float


# ── Tier 2 Endpoints ──────────────────────────────────────────


@router.post("/dc-power-flow", response_model=DCPowerFlowResponse)
async def dc_power_flow(request: DCPowerFlowRequest) -> DCPowerFlowResponse:
    """Run DC (linearized) power flow for fast network screening.

    DC power flow assumes flat voltage profile and lossless lines.
    100-1000× faster than AC power flow — ideal for contingency screening.
    """
    try:
        result = run_dc_power_flow(
            generation_fraction=request.generation_fraction,
            export_length_km=request.export_length_km,
            grid_ssc_mva=request.grid_ssc_mva,
        )
    except Exception as e:
        raise DomainError(f"DC power flow failed: {e}") from e

    return DCPowerFlowResponse(
        converged=result.converged,
        total_generation_mw=result.total_generation_mw,
        total_export_mw=result.total_export_mw,
        max_line_loading_percent=result.max_line_loading_percent,
        num_overloaded_lines=result.num_overloaded_lines,
        line_results=[
            DCLineResultSchema(
                name=lr.name, p_from_mw=lr.p_from_mw,
                loading_percent=lr.loading_percent, overloaded=lr.overloaded,
            )
            for lr in result.line_results
        ],
    )


@router.post("/dc-contingency-screening", response_model=DCContingencyResponse)
async def dc_contingency_screening(request: DCPowerFlowRequest) -> DCContingencyResponse:
    """Screen all N-1 string contingencies using fast DC power flow."""
    try:
        result = run_dc_contingency_screening(
            generation_fraction=request.generation_fraction,
            export_length_km=request.export_length_km,
            grid_ssc_mva=request.grid_ssc_mva,
        )
    except Exception as e:
        raise DomainError(f"DC contingency screening failed: {e}") from e

    return DCContingencyResponse(
        n_contingencies=result.n_contingencies,
        n_secure=result.n_secure,
        n_violations=result.n_violations,
        worst_contingency=result.worst_contingency,
        worst_loading_percent=result.worst_loading_percent,
    )


@router.post("/economic-dispatch", response_model=EconomicDispatchResponse)
async def economic_dispatch(request: EconomicDispatchRequest) -> EconomicDispatchResponse:
    """Run 24-hour economic dispatch with ramp rate compliance.

    Optimizes wind farm dispatch against grid code constraints (PSE IRiESP
    ramp limits: 10% Pn/min up, 20% Pn/min down) and curtailment costs.
    """
    forecast = generate_wind_forecast(mean_speed_ms=request.mean_wind_speed_ms)

    try:
        result = run_economic_dispatch(
            wind_forecast_mw=forecast,
            curtailment_order_mw=request.curtailment_order_mw,
            electricity_price_eur_mwh=request.electricity_price_eur_mwh,
        )
    except Exception as e:
        raise DomainError(f"Economic dispatch failed: {e}") from e

    return EconomicDispatchResponse(
        total_generation_mwh=result.total_generation_mwh,
        total_curtailment_mwh=result.total_curtailment_mwh,
        total_cost_eur=result.total_cost_eur,
        curtailment_cost_eur=result.curtailment_cost_eur,
        average_cost_eur_mwh=result.average_cost_eur_mwh,
        max_ramp_mw_min=result.max_ramp_mw_min,
        ramp_violations=result.ramp_violations,
        capacity_factor=result.capacity_factor,
        timesteps=[
            DispatchTimestepSchema(
                hour=ts.hour,
                wind_power_available_mw=ts.wind_power_available_mw,
                wind_power_dispatched_mw=ts.wind_power_dispatched_mw,
                curtailed_mw=ts.curtailed_mw,
                ramp_rate_mw_min=ts.ramp_rate_mw_min,
                ramp_compliant=ts.ramp_compliant,
                cost_eur=ts.cost_eur,
            )
            for ts in result.timesteps
        ],
    )


@router.post("/bess-dispatch", response_model=BESSResponse)
async def bess_dispatch(request: BESSRequest) -> BESSResponse:
    """Run battery energy storage dispatch optimization.

    Optimizes BESS charge/discharge against electricity prices to maximize
    revenue while reducing curtailment and smoothing ramps.
    """
    import numpy as np

    forecast = generate_wind_forecast(mean_speed_ms=request.mean_wind_speed_ms)

    try:
        result = run_bess_dispatch(
            wind_power_mw=forecast,
            grid_export_limit_mw=request.grid_export_limit_mw,
            bess_power_mw=request.bess_power_mw,
            bess_energy_mwh=request.bess_energy_mwh,
        )
    except Exception as e:
        raise DomainError(f"BESS dispatch failed: {e}") from e

    return BESSResponse(
        total_revenue_eur=result.total_revenue_eur,
        revenue_without_bess_eur=result.revenue_without_bess_eur,
        revenue_gain_eur=result.revenue_gain_eur,
        revenue_gain_percent=result.revenue_gain_percent,
        curtailment_without_bess_mwh=result.curtailment_without_bess_mwh,
        curtailment_with_bess_mwh=result.curtailment_with_bess_mwh,
        curtailment_reduction_mwh=result.curtailment_reduction_mwh,
        bess_cycles=result.bess_cycles,
        average_soc=result.average_soc,
        timesteps=[
            BESSTimestepSchema(
                hour=ts.hour, wind_power_mw=ts.wind_power_mw,
                bess_power_mw=ts.bess_power_mw, grid_export_mw=ts.grid_export_mw,
                soc=ts.soc, curtailed_mw=ts.curtailed_mw, revenue_eur=ts.revenue_eur,
            )
            for ts in result.timesteps
        ],
    )


@router.post("/ac-dc-comparison", response_model=ACDCComparisonResponse)
async def ac_dc_comparison(request: ACDCComparisonRequest) -> ACDCComparisonResponse:
    """Compare HVAC, HVDC-VSC, and hybrid export options.

    Evaluates cable losses, converter losses, reactive compensation needs,
    and relative CAPEX for each technology at the given cable length.
    """
    try:
        result = compare_export_options(
            cable_length_km=request.cable_length_km,
            capacity_factor=request.capacity_factor,
        )
    except Exception as e:
        raise DomainError(f"AC-DC comparison failed: {e}") from e

    return ACDCComparisonResponse(
        options=[
            ExportOptionSchema(
                technology=opt.technology, total_loss_mw=opt.total_loss_mw,
                loss_percent=opt.loss_percent, cable_loss_mw=opt.cable_loss_mw,
                converter_loss_mw=opt.converter_loss_mw,
                reactive_compensation_mvar=opt.reactive_compensation_mvar,
                annual_loss_gwh=opt.annual_loss_gwh, capex_index=opt.capex_index,
            )
            for opt in result.options
        ],
        recommended=result.recommended,
        recommendation_reason=result.recommendation_reason,
        loss_saving_mw=result.loss_saving_mw,
        loss_saving_gwh_year=result.loss_saving_gwh_year,
    )


@router.post("/capacity-expansion", response_model=CapacityExpansionResponse)
async def capacity_expansion(request: CapacityExpansionRequest) -> CapacityExpansionResponse:
    """Plan optimal capacity expansion for the P1-P5 wind farm portfolio.

    Computes phased buildout with technology learning curves, BESS integration
    for later phases, LCOE, NPV, and IRR per project.
    """
    try:
        result = plan_capacity_expansion(
            electricity_price_eur_mwh=request.electricity_price_eur_mwh,
            base_year=request.base_year,
            include_bess=request.include_bess,
        )
    except Exception as e:
        raise DomainError(f"Capacity expansion failed: {e}") from e

    return CapacityExpansionResponse(
        phases=[
            ProjectPhaseSchema(
                name=p.name, capacity_mw=p.capacity_mw,
                build_year=p.build_year, cod_year=p.cod_year,
                capex_meur=p.capex_meur, annual_aep_gwh=p.annual_aep_gwh,
                lcoe_eur_mwh=p.lcoe_eur_mwh, npv_meur=p.npv_meur,
                irr_percent=p.irr_percent, bess_mwh=p.bess_mwh,
            )
            for p in result.phases
        ],
        total_capacity_mw=result.total_capacity_mw,
        total_capex_meur=result.total_capex_meur,
        total_annual_aep_gwh=result.total_annual_aep_gwh,
        portfolio_lcoe_eur_mwh=result.portfolio_lcoe_eur_mwh,
        portfolio_npv_meur=result.portfolio_npv_meur,
        buildout_years=result.buildout_years,
        total_bess_mwh=result.total_bess_mwh,
    )
