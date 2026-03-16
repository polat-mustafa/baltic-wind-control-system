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
