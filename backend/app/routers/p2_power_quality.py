"""
Power Quality & Harmonics API endpoints — M06 (IEC 61000).

Endpoints
---------
POST   /api/v1/grid/power-quality/harmonics        — THD + individual harmonic analysis
POST   /api/v1/grid/power-quality/resonance-scan   — Network frequency scan (cable resonance)
POST   /api/v1/grid/power-quality/flicker          — Pst/Plt flicker severity calculation
POST   /api/v1/grid/power-quality/filter-design    — Passive single-tuned LC filter sizing
GET    /api/v1/grid/power-quality/limits           — IEC 61000-3-6 planning levels reference

Standards
---------
IEC 61000-3-6:2008 + AMD1:2018 — harmonic voltage planning levels (LV/MV/HV)
IEC 61000-3-7:2008              — flicker emission limits (Pst <= 1.0, Plt <= 0.65)
IEC 61400-21:2008               — wind turbine flicker coefficients
PSE IRiESP (2023)               — 220 kV POC: THD_V <= 3%, individual HV limits
"""

from __future__ import annotations

from fastapi import APIRouter

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
    summary="Harmonic distortion analysis (IEC 61000-3-6)",
)
async def analyse_harmonics(body: HarmonicSpectrumRequest) -> HarmonicAnalysisResponse:
    """
    Analyse harmonic voltage distortion against IEC 61000-3-6 planning levels.

    **Physics — why harmonics matter for offshore wind:**

    VSC converters (Type IV turbines, HVDC) inject harmonic currents at characteristic
    orders: 5th, 7th, 11th, 13th (6k±1 pattern). These flow through the cable
    impedance and create voltage distortion at the POC.

    THD_V = sqrt(U_2^2 + U_3^2 + ... + U_50^2) / U_1 x 100 %

    **IEC 61000-3-6 voltage tier limits:**
    - LV (< 1 kV):  THD <= 8%,  individual H5 <= 6%
    - MV (1-35 kV): THD <= 8%,  individual H5 <= 5%
    - HV (>= 35 kV): THD <= 3%, individual H5 <= 2%  ← applies at 220 kV PSE POC

    **Example: Baltic Wind 220 kV POC**
    With a typical VSC harmonic spectrum {5: 1.2, 7: 0.9, 11: 0.6, 13: 0.5} %,
    THD = 1.7% — compliant with 3% HV limit. The 5th harmonic at 1.2% approaches
    the 2.0% HV planning level — a passive 5th harmonic filter may be warranted
    if background distortion from the grid is already elevated.

    **Request:** provide harmonic_magnitudes as {order: magnitude_pct} for orders 2-50.
    Voltage kV selects the applicable voltage tier.
    """
    result = svc.compute_harmonics(
        body.harmonic_magnitudes,
        body.voltage_kv,
        body.rated_mw,
    )
    return HarmonicAnalysisResponse(**result)


@router.post(
    "/power-quality/resonance-scan",
    response_model=ResonanceScanResponse,
    summary="Network frequency scan — cable resonance detection",
)
async def resonance_scan(body: ResonanceScanRequest) -> ResonanceScanResponse:
    """
    Sweep network impedance vs frequency to find parallel resonance peaks.

    **Physics — cable resonance mechanism:**

    An export cable has distributed inductance (L') and capacitance (C').
    The cable forms a natural LC resonator with the grid inductance:

        f_r = 1 / (2*pi*sqrt(L_total * C_total))

    If a harmonic current source (e.g., 5th = 250 Hz) coincides with a resonance
    peak, the harmonic voltage is amplified. This can cause:
    - Overvoltages exceeding 110% at cable receiving end
    - Transformer insulation stress
    - Control instability in VSC converters

    **220 kV cable example (45 km):**
    - L_total = 0.35 mH/km * 45 km = 15.75 mH
    - C_total = 0.22 uF/km * 45 km = 9.9 uF
    - f_r = 1/(2*pi*sqrt(15.75e-3 * 9.9e-6)) = **403 Hz** ≈ 8th harmonic

    This is why the 7th (350 Hz) is relatively safe but the 9th (450 Hz) is
    close to the resonance — a passive 9th filter or detuning may be needed.

    **Scan output:** impedance magnitude [ohm] vs frequency [Hz].
    Peaks > 5 ohm are classified as resonance points with risk level.
    """
    result = svc.compute_resonance_scan(
        body.cable_length_km,
        body.voltage_kv,
        body.grid_fault_level_mva,
        body.scan_max_hz,
    )
    return ResonanceScanResponse(**result)


@router.post(
    "/power-quality/flicker",
    response_model=FlickerResponse,
    summary="Flicker severity (Pst/Plt) — IEC 61000-3-7 / IEC 61400-21",
)
async def calculate_flicker(body: FlickerRequest) -> FlickerResponse:
    """
    Calculate short-term (Pst) and long-term (Plt) flicker severity.

    **Physics — what causes flicker in wind farms:**

    Flicker is rapid voltage fluctuation (1-35 Hz) that causes visible lamp flicker.
    In wind farms, three sources contribute:

    1. **Tower shadow** — 3p rotational sampling of wind shear: at 15 rpm,
       3 blades x 0.25 Hz = 0.75 Hz voltage pulsation. For V236 at 8 rpm: ~0.4 Hz.
    2. **Turbulence** — wind speed fluctuation creates power fluctuation.
       VSC full converters (Type IV) decouple the turbine from the grid
       almost completely — flicker is much lower than direct-drive or fixed-speed.
    3. **Switching** — turbine start/stop creates voltage step changes.

    **IEC 61400-21 Method:**
    Continuous: Pst = c_f(psi_k) * sqrt(n) * S_n / S_k
    Switching:  Pst_sw = k_f(psi_k) * S_n / S_k * N_10^0.31

    Where psi_k = grid impedance angle (higher = stiffer grid = less flicker).
    For V236-15MW (full converter): c_f ≈ 0.18-0.38 depending on grid angle.

    **IEC 61000-3-7 limits:** Pst <= 1.0, Plt <= 0.65

    For a 510 MW farm at 2500 MVA fault level: Pst ≈ 0.09-0.14 — well within limits.
    Flicker is generally not the binding power quality constraint for Baltic Wind.
    """
    result = svc.compute_flicker(
        body.rated_mw,
        body.grid_fault_level_mva,
        body.grid_impedance_angle_deg,
        body.annual_switching_operations,
    )
    return FlickerResponse(**result)


@router.post(
    "/power-quality/filter-design",
    response_model=FilterDesignResponse,
    summary="Passive single-tuned LC harmonic filter sizing",
)
async def design_filter(body: FilterDesignRequest) -> FilterDesignResponse:
    """
    Size a single-tuned passive LC harmonic filter.

    **Physics — how a passive harmonic filter works:**

    A series LC circuit tuned near a harmonic frequency presents low impedance
    at that frequency. Harmonic currents prefer the low-impedance path (filter)
    over the high-impedance path (grid), achieving harmonic current diversion.

    **Design parameters:**
    1. **Tuning frequency:** slightly below harmonic (3% detuning)
       f_t = h * 50 * (1 - 0.03) — protects against upward frequency drift with ageing

    2. **Capacitor bank:** sized for reactive power compensation at 50 Hz
       C = Q_MVAR / (omega_1 * V^2)  [per phase in Farads]

    3. **Reactor:** tuned to target frequency
       L = 1 / (omega_t^2 * C)  [per phase in Henrys]

    4. **Quality factor Q = omega_t * L / R**
       - Q = 30-80 is optimal: too low → broad-band response (unstable tuning)
       - Too high → very narrow response (sensitive to component tolerance)
       - Typical: Q = 50 for offshore substation application

    5. **Insertion loss IL [dB]:** at tuned frequency, > 20 dB target
       IL = 20 * log10(Z_sys / Z_parallel)

    **Side effect — reactive compensation:**
    The capacitor bank contributes reactive power at fundamental frequency:
    Q_c = V^2 / X_C,50Hz — reduces reactive import from grid.

    **Example: 5th harmonic filter at 66 kV, 10 MVAR:**
    - f_t = 242.5 Hz (3% below 250 Hz)
    - C = 10e6 / (314 * 66e3^2) = 7.3 uF
    - L = 1 / (1524^2 * 7.3e-6) = 59 mH
    - IL ≈ 28 dB — eliminates ~99% of 5th harmonic voltage
    """
    result = svc.design_passive_filter(
        body.dominant_harmonic_order,
        body.harmonic_current_a,
        body.system_voltage_kv,
        body.rated_mvar,
    )
    return FilterDesignResponse(**result)


@router.get(
    "/power-quality/limits",
    response_model=HarmonicLimitsResponse,
    summary="IEC 61000-3-6 harmonic planning levels reference",
)
async def get_harmonic_limits() -> HarmonicLimitsResponse:
    """
    Return complete IEC 61000-3-6:2008 planning levels table for all voltage tiers.

    **Why planning levels exist:**
    IEC 61000-3-6 defines the maximum allowable harmonic voltage distortion
    that power system operators may permit at their network nodes. They are
    "planning levels" — internal TSO/DSO design targets — not emission limits.

    The actual emission allocation for an individual customer (the wind farm)
    is negotiated via a connection agreement and is typically 20-30% below
    the planning level, leaving room for background distortion.

    **Key planning levels for Baltic Wind (220 kV HV tier):**
    | Order | HV Limit |
    |-------|---------|
    | 5th   | 2.0%    | ← dominant VSC harmonic
    | 7th   | 2.0%    | ← 2nd dominant VSC harmonic
    | 11th  | 1.5%    |
    | 13th  | 1.5%    |
    | THD   | 3.0%    |

    **PSE note:** Polish TSO applies HV limits at the 220 kV connection point.
    The connection agreement (IRiESP Table D.3) confirms THD_V <= 3%.
    """
    result = svc.get_harmonic_limits()
    return HarmonicLimitsResponse(**result)
