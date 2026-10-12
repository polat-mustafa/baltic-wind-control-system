"""
Power quality API — harmonics, resonance scan, flicker, filter design.

Endpoints
---------
POST /api/v1/grid/power-quality/harmonics       — WTG emission → harmonic voltages at a bus
POST /api/v1/grid/power-quality/resonance-scan  — |Z(f)| of the network, parallel resonances
POST /api/v1/grid/power-quality/flicker         — P_st / P_lt at the POC
POST /api/v1/grid/power-quality/filter-design   — single-tuned filter at OSS 66 kV
GET  /api/v1/grid/power-quality/limits          — planning levels
POST /api/v1/grid/power-quality/converter-stability — detailed array, converter Norton
     models, generalized Nyquist stability of the 34 converters (services/p2/harmonic_stability.py)

Standards
---------
IEC TR 61000-3-6:2008 — harmonic planning levels (MV, HV-EHV; THD 6.5 % / 3 %)
IEC 61000-3-7:2008    — flicker planning levels (HV-EHV P_st 0.8, P_lt 0.6)
IEC 61400-21          — wind turbine harmonic emission and flicker coefficients

The harmonic model and its limits are documented in services/p2/power_quality.py.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.exceptions import ValidationError
from app.routers.farm_spec import FarmSpecDep
from app.schemas.power_quality import (
    ConverterStabilityRequest,
    ConverterStabilityResponse,
    FilterDesignRequest,
    FilterDesignResponse,
    FlickerRequest,
    FlickerResponse,
    HarmonicAnalysisResponse,
    HarmonicBusRow,
    HarmonicLimitsResponse,
    HarmonicSpectrumRequest,
    ResonanceScanRequest,
    ResonanceScanResponse,
)
from app.services.p2 import harmonic_stability as hs
from app.services.p2 import power_quality as svc

router = APIRouter(tags=["M06 Power Quality & Harmonics"])


@router.post(
    "/power-quality/harmonics",
    response_model=HarmonicAnalysisResponse,
    summary="Harmonic voltages from WTG emission (IEC TR 61000-3-6)",
)
def analyse_harmonics(body: HarmonicSpectrumRequest, spec: FarmSpecDep) -> HarmonicAnalysisResponse:
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
def resonance_scan(body: ResonanceScanRequest, spec: FarmSpecDep) -> ResonanceScanResponse:
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
def flicker(body: FlickerRequest, spec: FarmSpecDep) -> FlickerResponse:
    """Continuous-operation and switching flicker, cubic sum, vs HV-EHV planning levels."""
    return FlickerResponse(
        **svc.compute_flicker(
            body.rated_mw,
            body.grid_fault_level_mva or spec.grid_ssc_mva,
            body.grid_impedance_angle_deg,
            body.n10,
            body.n120,
        )
    )


@router.post(
    "/power-quality/filter-design",
    response_model=FilterDesignResponse,
    summary="Single-tuned harmonic filter",
)
def filter_design(body: FilterDesignRequest, spec: FarmSpecDep) -> FilterDesignResponse:
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
def harmonic_limits() -> HarmonicLimitsResponse:
    """IEC TR 61000-3-6 planning levels for orders 2–25 (and LV compatibility levels)."""
    return HarmonicLimitsResponse(**svc.get_harmonic_limits())


@router.post(
    "/power-quality/converter-stability",
    response_model=ConverterStabilityResponse,
    summary="Converter–network interaction: Norton models and impedance-based stability",
)
def converter_stability(
    body: ConverterStabilityRequest, spec: FarmSpecDep
) -> ConverterStabilityResponse:
    """Every array section and WTG transformer modelled; each converter a Norton equivalent
    (delayed current control, damped LCL). Generalized Nyquist on det(I + Z·Y) gives the
    verdict, the characteristic loci the margins. Converter data are typical, not a
    vendor's — the result shows what a connection-stage study checks, not a guarantee."""
    conv = hs.ConverterModel(
        l_filter_pu=body.l_filter_pu,
        c_filter_pu=body.c_filter_pu,
        f_sw_hz=body.f_sw_hz,
        bandwidth_hz=body.bandwidth_hz,
        feedforward=body.feedforward,
        damping_r_pu=body.damping_r_pu,
    )
    try:
        conv.check()
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    n_on = body.turbines_in_service
    if n_on is not None and n_on > spec.num_turbines:
        raise ValidationError(f"the farm has {spec.num_turbines} turbines")
    ssc = spec.grid_ssc_mva * body.grid_ssc_factor
    poles_sa, margin_sa = hs.standalone_stability(conv)
    r = hs.assess_stability(spec, conv, ssc, body.coupler_closed, n_on)
    norton = hs.harmonic_voltages(spec, conv, ssc, body.coupler_closed, norton=True)
    ideal = hs.harmonic_voltages(spec, conv, ssc, body.coupler_closed, norton=False)
    thd_n, thd_i = hs.thd_by_bus(norton), hs.thd_by_bus(ideal)
    return ConverterStabilityResponse(
        lcl_resonance_hz=round(conv.lcl_resonance_hz, 1),
        non_passive_from_hz=r.non_passive_from_hz,
        damping_r_pu=round(conv.r_damp_pu, 4),
        standalone_stable=poles_sa == 0,
        standalone_vector_margin=margin_sa,
        stable=r.stable,
        unstable_poles=r.unstable_poles,
        vector_margin=r.vector_margin,
        vector_margin_hz=r.vector_margin_hz,
        phase_margin_deg=r.phase_margin_deg,
        phase_margin_hz=r.phase_margin_hz,
        loci_hz=list(r.loci_hz),
        loci_min_distance=list(r.loci_min_distance),
        thd_norton_pct={k: v["thd_pct"] for k, v in thd_n.items()},
        thd_ideal_sources_pct={k: v["thd_pct"] for k, v in thd_i.items()},
        thd_limit_pct={k: v["limit_pct"] for k, v in thd_n.items()},
        harmonics=[HarmonicBusRow(**row) for row in norton],
        assumptions=[
            "Converter: converter-side current control, P gain, 1.5-sample delay, damped LCL "
            "— typical MV full-converter values, not a vendor model",
            "PLL and the 50 Hz resonant controller omitted (valid from ~100 Hz up)",
            "Emission: illustrative IEC 61400-21-style currents as Norton sources, "
            "IEC 61000-3-6 summation exponents",
        ],
    )
