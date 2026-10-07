"""
Power quality API — harmonics, resonance scan, flicker, filter design.

Endpoints
---------
POST /api/v1/grid/power-quality/harmonics       — WTG emission → harmonic voltages at a bus
POST /api/v1/grid/power-quality/resonance-scan  — |Z(f)| of the network, parallel resonances
POST /api/v1/grid/power-quality/flicker         — P_st / P_lt at the POC
POST /api/v1/grid/power-quality/filter-design   — single-tuned filter at OSS 66 kV
GET  /api/v1/grid/power-quality/limits          — planning levels

Standards
---------
IEC TR 61000-3-6:2008 — harmonic planning levels (MV, HV-EHV; THD 6.5 % / 3 %)
IEC 61000-3-7:2008    — flicker planning levels (HV-EHV P_st 0.8, P_lt 0.6)
IEC 61400-21          — wind turbine harmonic emission and flicker coefficients

The harmonic model and its limits are documented in services/p2/power_quality.py.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routers.farm_spec import FarmSpecDep
from app.schemas.power_quality import (
    FilterDesignRequest,
    FilterDesignResponse,
    FlickerRequest,
    FlickerResponse,
    HarmonicAnalysisResponse,
    HarmonicLimitsResponse,
    HarmonicSpectrumRequest,
    ResonanceScanRequest,
    ResonanceScanResponse,
)
from app.services.p2 import power_quality as svc

router = APIRouter(tags=["M06 Power Quality & Harmonics"])


@router.post(
    "/power-quality/harmonics",
    response_model=HarmonicAnalysisResponse,
    summary="Harmonic voltages from WTG emission (IEC TR 61000-3-6)",
)
async def analyse_harmonics(
    body: HarmonicSpectrumRequest, spec: FarmSpecDep
) -> HarmonicAnalysisResponse:
    """Sum the 34 WTGs' current emission (IEC 61000-3-6 exponents), pass it
    through the network's harmonic impedance and compare the voltage at the
    chosen bus with the planning levels."""
    return HarmonicAnalysisResponse(
        **svc.compute_harmonics(
            body.harmonic_magnitudes,
            body.voltage_kv,
            body.rated_mw,
            body.grid_fault_level_mva,
            spec=spec,
        )
    )


@router.post(
    "/power-quality/resonance-scan",
    response_model=ResonanceScanResponse,
    summary="Network frequency scan",
)
async def resonance_scan(body: ResonanceScanRequest, spec: FarmSpecDep) -> ResonanceScanResponse:
    """|Z(f)| seen from OSS 66 kV, OSS 220 kV or the POC, with amplified resonances —
    long HVAC cables + reactors + transformer/grid inductance resonate at low orders."""
    return ResonanceScanResponse(
        **svc.compute_resonance_scan(
            body.cable_length_km,
            body.voltage_kv,
            body.grid_fault_level_mva,
            body.scan_max_hz,
            spec=spec,
        )
    )


@router.post(
    "/power-quality/flicker",
    response_model=FlickerResponse,
    summary="Flicker severity at the POC (IEC 61400-21)",
)
async def flicker(body: FlickerRequest) -> FlickerResponse:
    """Continuous-operation and switching flicker, cubic sum, vs HV-EHV planning levels."""
    return FlickerResponse(
        **svc.compute_flicker(
            body.rated_mw,
            body.grid_fault_level_mva,
            body.grid_impedance_angle_deg,
            body.annual_switching_operations,
        )
    )


@router.post(
    "/power-quality/filter-design",
    response_model=FilterDesignResponse,
    summary="Single-tuned harmonic filter",
)
async def filter_design(body: FilterDesignRequest, spec: FarmSpecDep) -> FilterDesignResponse:
    """Size C and L for a target order (tuned 3 % low) and rate its attenuation
    against the network's harmonic impedance at that order."""
    return FilterDesignResponse(
        **svc.design_passive_filter(
            body.dominant_harmonic_order,
            body.harmonic_current_a,
            body.system_voltage_kv,
            body.rated_mvar,
            spec=spec,
        )
    )


@router.get(
    "/power-quality/limits",
    response_model=HarmonicLimitsResponse,
    summary="Harmonic planning levels",
)
async def harmonic_limits() -> HarmonicLimitsResponse:
    """IEC TR 61000-3-6 planning levels for orders 2–25 (and LV compatibility levels)."""
    return HarmonicLimitsResponse(**svc.get_harmonic_limits())
