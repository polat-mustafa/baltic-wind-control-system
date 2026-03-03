"""
P2 HV Grid Integration API endpoints.

Provides REST endpoints for:
- Load flow analysis (Newton-Raphson via Pandapower)
- Short-circuit calculation (IEC 60909)
- STATCOM reactive power compensation sizing
- Fault ride-through simulation (ANDES TDS)
- GFL vs GFM converter comparison
- Network specification constants

All endpoints follow the convention: /api/v1/grid/{resource}

Data approach: uses Pandapower + ANDES for physics-based simulation
of the 510 MW offshore wind farm network (34 × V236-15.0 MW,
66 kV array, 220 kV export, 400 kV PSE grid).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.cache import cached
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
from app.services.p2.converter_comparison import get_comparison_response
from app.services.p2.dynamic_compliance import run_full_compliance_assessment
from app.services.p2.frequency_response import run_frequency_response
from app.services.p2.frt_simulation import run_frt_simulation
from app.services.p2.load_flow import run_all_scenarios, run_load_flow
from app.services.p2.network_model import (
    EXPORT_CABLE_LENGTH_KM,
    GRID_SSC_MVA,
    STATCOM_RATING_MVAR,
    STRING_LAYOUT,
    TOTAL_CAPACITY_MW,
)
from app.services.p2.short_circuit import calc_short_circuit
from app.services.p2.sso_analysis import run_sso_screening
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Load flow analysis failed: {e}",
        ) from e


@router.get("/load-flow-all", response_model=list[LoadFlowResponse])
async def load_flow_all_scenarios() -> list[LoadFlowResponse]:
    """Run load flow for all four standard PSE IRiESP scenarios.

    Returns results for full_load, partial_load, no_load, and n_minus_1.
    """
    try:
        return run_all_scenarios(auto_dispatch=True)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Load flow analysis failed: {e}",
        ) from e


@router.get("/short-circuit/{case}", response_model=ShortCircuitResponse)
async def short_circuit(case: str) -> ShortCircuitResponse:
    """Run IEC 60909 short-circuit calculation at all buses.

    Case 'max' (c=1.1) for breaker sizing, 'min' (c=1.0) for protection
    sensitivity. Returns Ik'', ip, Sk'' per bus with breaker adequacy check.
    """
    if case not in ("max", "min"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid case: '{case}'. Must be 'max' or 'min'.",
        )
    try:
        return calc_short_circuit(case=case)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Short-circuit calculation failed: {e}",
        ) from e


@router.get("/statcom-sizing", response_model=STATCOMSizingResult)
async def statcom_sizing() -> STATCOMSizingResult:
    """Validate STATCOM and reactive power compensation sizing.

    Compares load flow with/without compensation to demonstrate
    Ferranti voltage rise and STATCOM necessity. Returns cable Q
    generation, reactor absorption, and compensation adequacy.
    """
    try:
        return validate_compensation()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"STATCOM sizing failed: {e}",
        ) from e


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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"FRT simulation failed: {e}",
        ) from e


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
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario: '{scenario}'. Must be 'strong_grid' or 'weak_grid'.",
        )
    try:
        return get_comparison_response(scenario=scenario, grid_ssc_mva=grid_ssc)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Converter comparison failed: {e}",
        ) from e


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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Dynamic compliance assessment failed: {e}",
        ) from e


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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Frequency response simulation failed: {e}",
        ) from e


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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SSO analysis failed: {e}",
        ) from e


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
