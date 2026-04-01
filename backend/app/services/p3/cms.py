"""
Condition Monitoring System (CMS) service — M12.

Manages turbine component health, generates FFT spectra, estimates
Remaining Useful Life (RUL), and supports fault injection for training.

Physics — Why CMS Prevents €200k–€500k Failures
--------------------------------------------------
An unplanned main bearing failure on a 15 MW offshore turbine costs:
  - Component (incl. crane): €150k–€300k
  - Lost generation (2–6 weeks × 15 MW × €50/MWh): €50k–€300k
  - Vessel/logistics (jack-up day rate ~€80k): €80k–€200k
  Total: €280k–€800k per event

A CMS detecting incipient bearing failure 30–60 days in advance enables:
  - Planned maintenance (CTV access, pre-ordered parts): ~€80k total
  - Net saving: €200k–€720k per avoided unplanned failure

Health Index Model (simplified ISO 13381-1)
--------------------------------------------
The health index (HI) tracks component condition from 100 (new) to 0
(failed). Degradation is modelled as:

  dHI/dt = -rate [points/day]

Where rate depends on the degradation mode:
  - Bearing fatigue (normal)  : ~0.05–0.1/day (20+ years life)
  - Early bearing wear        : ~0.3–0.5/day (6–9 months)
  - Accelerated degradation   : ~1–3/day (weeks to failure)
  - Spalling / advanced fault : ~5–10/day (days to failure)

ISO 10816-21 Vibration Severity Zones (Wind Turbines, Class I)
---------------------------------------------------------------
  Zone A (new)       : v_rms < 2.3 mm/s  → HI > 80
  Zone B (acceptable): 2.3–4.5 mm/s      → HI 60–80
  Zone C (alert)     : 4.5–7.1 mm/s      → HI 30–60
  Zone D (danger)    : > 7.1 mm/s        → HI < 30

FFT Spectrum Generation
------------------------
Characteristic fault frequencies for a direct-drive equivalent:
  - Shaft rotation frequency: f_shaft = RPM / 60
  - BPFO (main bearing): f_bpfo = n_balls × f_shaft × (1 - d/D × cos α) / 2
    Approximate: BPFO ≈ 0.4 × n_balls × f_shaft
  - Gear mesh frequency: f_gm = n_teeth × f_shaft
  - Twice electrical frequency: 2 × 50 Hz = 100 Hz (generator)

Standards: ISO 10816-21, ISO 13373, ISO 13381-1, IEC 61400-4, ISO 4406.
"""

from __future__ import annotations

import random
import uuid
from datetime import UTC, datetime

from app.schemas.cms import (
    CMSAlertResponse,
    ComponentHealthSchema,
    FaultInjectionRequest,
    FaultInjectionResponse,
    FFTPoint,
    FleetHealthResponse,
    OilAnalysisPoint,
    OilAnalysisResponse,
    TurbineHealthResponse,
    TurbineHealthSummary,
    VibrationSpectrumResponse,
)

# ── Configuration constants ───────────────────────────────────────

N_TURBINES: int = 34

# ISO 10816-21 Class I wind turbine vibration thresholds [mm/s]
VIB_ZONE_A: float = 2.3  # Zone A/B boundary
VIB_ZONE_B: float = 4.5  # Zone B/C boundary
VIB_ZONE_C: float = 7.1  # Zone C/D boundary

# V236-15.0 MW turbine mechanical parameters (approximate)
MAIN_SHAFT_RPM_RATED: float = 8.5  # rated rotor speed
GEARBOX_RATIO: float = 100.0  # approximate for high-speed shaft
MAIN_BEARING_BALLS: int = 22  # main bearing rolling elements
GEARBOX_TEETH_STAGE1: int = 54  # first stage gear teeth

# Alert level thresholds (HI boundaries)
ALERT_THRESHOLDS: dict[str, float] = {
    "CRITICAL": 20.0,
    "RED": 40.0,
    "AMBER": 60.0,
    "YELLOW": 80.0,
    "GREEN": 100.0,
}

# Degradation rates per severity level [HI points/day]
DEGRADATION_RATES: dict[str, float] = {
    "MINOR": 0.5,
    "MODERATE": 2.0,
    "SEVERE": 5.0,
}

# Typical baseline temperatures per component [°C]
BASELINE_TEMPS: dict[str, float] = {
    "MAIN_BEARING": 45.0,
    "GEARBOX": 65.0,
    "GENERATOR": 80.0,
    "PITCH": 35.0,
    "YAW": 40.0,
}

# Baseline oil ISO codes
BASELINE_OIL_CODE: str = "16/14/11"

# ── In-memory fleet health state ─────────────────────────────────
#
# Production system uses TimescaleDB for historical data and Redis for
# current state. Here we maintain an in-memory health model.

# Injected faults: {turbine_id: {component: {rate, start_hi, start_time}}}
_injected_faults: dict[str, dict[str, dict[str, float]]] = {}


def _get_seed(turbine_id: str, component: str) -> int:
    """Deterministic seed so each turbine/component has stable baseline health."""
    return hash(f"{turbine_id}-{component}") % (2**31)


def _hi_to_alert_level(hi: float) -> str:
    if hi < ALERT_THRESHOLDS["CRITICAL"]:
        return "CRITICAL"
    if hi < ALERT_THRESHOLDS["RED"]:
        return "RED"
    if hi < ALERT_THRESHOLDS["AMBER"]:
        return "AMBER"
    if hi < ALERT_THRESHOLDS["YELLOW"]:
        return "YELLOW"
    return "GREEN"


def _hi_to_vib(hi: float) -> float:
    """Map health index to vibration RMS velocity [mm/s].

    Inverse of the HI model: as HI drops from 100 → 0, vibration
    rises from baseline towards Zone D.
    """
    # HI 80-100: Zone A (0.5-2.3 mm/s)
    # HI 60-80:  Zone B (2.3-4.5 mm/s)
    # HI 30-60:  Zone C (4.5-7.1 mm/s)
    # HI 0-30:   Zone D (7.1-15 mm/s)
    if hi >= 80.0:
        return 0.5 + (100.0 - hi) / 20.0 * (VIB_ZONE_A - 0.5)
    if hi >= 60.0:
        return VIB_ZONE_A + (80.0 - hi) / 20.0 * (VIB_ZONE_B - VIB_ZONE_A)
    if hi >= 30.0:
        return VIB_ZONE_B + (60.0 - hi) / 30.0 * (VIB_ZONE_C - VIB_ZONE_B)
    return VIB_ZONE_C + (30.0 - hi) / 30.0 * (15.0 - VIB_ZONE_C)


def _hi_to_temp(component: str, hi: float) -> float:
    """Map health index to temperature [°C].

    Higher temperatures indicate increased friction/load as components degrade.
    """
    baseline = BASELINE_TEMPS.get(component, 50.0)
    # +30°C at end of life
    delta = (100.0 - hi) / 100.0 * 30.0
    return round(baseline + delta, 1)


def _compute_current_hi(turbine_id: str, component: str) -> float:
    """Compute current health index for a turbine/component.

    Uses deterministic pseudo-random baseline (95–100 HI for healthy
    components) modified by any injected fault degradation.
    """
    rng = random.Random(_get_seed(turbine_id, component))
    base_hi = 90.0 + rng.uniform(0.0, 10.0)  # 90–100 for healthy fleet

    fault = _injected_faults.get(turbine_id, {}).get(component)
    if fault is not None:
        elapsed_days = (datetime.now(UTC).timestamp() - fault["start_time"]) / 86400.0
        degradation = fault["rate"] * elapsed_days
        base_hi = max(0.0, fault["start_hi"] - degradation)

    return round(base_hi, 1)


def _estimate_rul(turbine_id: str, component: str) -> float:
    """Estimate remaining useful life in days.

    Uses current degradation rate if a fault is injected.
    Otherwise assumes healthy fleet with nominal degradation (0.05/day).
    """
    hi = _compute_current_hi(turbine_id, component)
    fault = _injected_faults.get(turbine_id, {}).get(component)
    rate = fault["rate"] if fault else 0.05  # nominal healthy degradation
    if rate <= 0.0:
        return 9999.0
    return round(hi / rate, 1)


def _compute_component_health(turbine_id: str, component: str) -> ComponentHealthSchema:
    hi = _compute_current_hi(turbine_id, component)
    vib = round(_hi_to_vib(hi), 2)
    temp = _hi_to_temp(component, hi)
    rul = _estimate_rul(turbine_id, component)
    alert = _hi_to_alert_level(hi)

    # Gearbox gets a simulated oil ISO code
    if component == "GEARBOX" and hi < 60.0:
        oil = "18/16/13"  # degraded
    elif component == "GEARBOX" and hi < 80.0:
        oil = "17/15/12"  # slightly dirty
    else:
        oil = BASELINE_OIL_CODE

    return ComponentHealthSchema(
        component=component,
        health_index=hi,
        alert_level=alert,
        vib_rms_mm_s=vib,
        temp_celsius=temp,
        oil_iso_code=oil,
        rul_days=rul,
        last_updated=datetime.now(UTC),
    )


# ── Public service functions ──────────────────────────────────────


def get_turbine_health(turbine_id: str) -> TurbineHealthResponse:
    """Return per-component health status for one turbine."""
    from app.models.cms import CMS_COMPONENTS

    components = [_compute_component_health(turbine_id, c) for c in CMS_COMPONENTS]
    worst_hi = min(c.health_index for c in components)
    worst_alert = _hi_to_alert_level(worst_hi)
    active_alerts = sum(1 for c in components if c.alert_level not in ("GREEN", "YELLOW"))

    return TurbineHealthResponse(
        turbine_id=turbine_id,
        overall_health_index=round(worst_hi, 1),
        overall_alert_level=worst_alert,
        components=components,
        active_alerts=active_alerts,
        last_updated=datetime.now(UTC),
    )


def get_fleet_health() -> FleetHealthResponse:
    """Return compact health summary for all 34 turbines."""
    from app.models.cms import CMS_COMPONENTS

    summaries: list[TurbineHealthSummary] = []
    total_hi = 0.0

    for n in range(1, N_TURBINES + 1):
        turbine_id = f"WTG-{n:02d}"
        components = [_compute_component_health(turbine_id, c) for c in CMS_COMPONENTS]
        worst = min(components, key=lambda c: c.health_index)
        active = sum(1 for c in components if c.alert_level not in ("GREEN", "YELLOW"))
        summaries.append(
            TurbineHealthSummary(
                turbine_id=turbine_id,
                overall_health_index=round(worst.health_index, 1),
                overall_alert_level=worst.alert_level,
                worst_component=worst.component,
                active_alerts=active,
            )
        )
        total_hi += worst.health_index

    in_warning = sum(1 for s in summaries if s.overall_alert_level in ("RED", "CRITICAL"))
    in_alert = sum(1 for s in summaries if s.overall_alert_level == "AMBER")
    total_alerts = sum(s.active_alerts for s in summaries)

    return FleetHealthResponse(
        turbines=summaries,
        fleet_average_hi=round(total_hi / N_TURBINES, 1),
        turbines_in_warning=in_warning,
        turbines_in_alert=in_alert,
        active_alerts_total=total_alerts,
        timestamp_utc=datetime.now(UTC),
    )


def get_vibration_spectrum(turbine_id: str, component: str) -> VibrationSpectrumResponse:
    """Generate a simulated FFT vibration spectrum (0–500 Hz, 200 points).

    The spectrum shows:
    - Broad-band noise floor (dependent on HI — higher when degraded)
    - Shaft rotation harmonics (f_shaft, 2×, 3×)
    - Bearing fault frequencies (BPFO, BPFI) as isolated peaks
    - Gear mesh frequency and sidebands (gearbox only)

    Physics — bearing fault frequencies
    -------------------------------------
    BPFO = n_balls × f_shaft × (1 - (d/D)×cosα) / 2
    For V236 main bearing (approximate): BPFO ≈ 0.4 × 22 × (8.5/60) ≈ 1.24 Hz

    At rated speed the fault frequency is in the low-frequency range
    (< 5 Hz for main bearing) — requires vibration sensors with flat
    frequency response down to 0.5 Hz (piezoelectric accelerometers).
    """
    hi = _compute_current_hi(turbine_id, component)
    rng = random.Random(_get_seed(turbine_id, component) + 1)

    # Shaft frequency at rated operation
    f_shaft = MAIN_SHAFT_RPM_RATED / 60.0  # ~0.142 Hz

    # Characteristic fault frequencies
    f_bpfo = 0.4 * MAIN_BEARING_BALLS * f_shaft  # ~1.24 Hz
    f_bpfi = 0.6 * MAIN_BEARING_BALLS * f_shaft  # ~1.85 Hz
    f_gm = GEARBOX_TEETH_STAGE1 * f_shaft * GEARBOX_RATIO  # ~76 Hz

    # Noise floor depends on HI (higher noise = worse health)
    noise_floor = 0.1 + (100.0 - hi) / 100.0 * 0.5

    points: list[FFTPoint] = []
    dominant_freq = 0.0
    dominant_amp = 0.0

    for i in range(200):
        freq = i * 2.5  # 0–497.5 Hz in 2.5 Hz steps
        amp = noise_floor + rng.uniform(0.0, noise_floor * 0.3)

        # Add shaft harmonics
        for harmonic in range(1, 5):
            if abs(freq - harmonic * f_shaft * 1000 / 2.5) < 1.5:
                amp += 0.5 * (100.0 - hi) / 100.0 + 0.1

        # Add bearing fault frequencies (amplified when HI < 60)
        degradation_factor = max(0.0, (60.0 - hi) / 60.0)
        for fault_freq in (f_bpfo, f_bpfi, 2 * f_bpfo, 3 * f_bpfo):
            if abs(freq - fault_freq) < 3.0:
                amp += degradation_factor * (VIB_ZONE_C - VIB_ZONE_A) * 0.5

        # Add gear mesh frequency
        if component == "GEARBOX" and abs(freq - f_gm) < 5.0:
            amp += (100.0 - hi) / 100.0 * VIB_ZONE_B

        # Add generator electrical frequency (100 Hz)
        if component == "GENERATOR" and abs(freq - 100.0) < 3.0:
            amp += 0.3

        amp = max(0.0, amp)
        if amp > dominant_amp:
            dominant_amp = amp
            dominant_freq = freq

        points.append(FFTPoint(frequency_hz=round(freq, 1), amplitude_mm_s=round(amp, 4)))

    fault_markers = [
        {"freq_hz": round(f_bpfo, 2), "label": "BPFO"},
        {"freq_hz": round(f_bpfi, 2), "label": "BPFI"},
        {"freq_hz": round(f_gm, 1), "label": "GMF"},
        {"freq_hz": 100.0, "label": "2x50Hz"},
    ]

    return VibrationSpectrumResponse(
        turbine_id=turbine_id,
        component=component,
        timestamp_utc=datetime.now(UTC),
        points=points,
        dominant_frequency_hz=round(dominant_freq, 2),
        dominant_amplitude_mm_s=round(dominant_amp, 4),
        fault_frequency_markers=fault_markers,
    )


def get_oil_analysis(turbine_id: str) -> OilAnalysisResponse:
    """Return gearbox oil analysis history (12 monthly data points)."""
    hi = _compute_current_hi(turbine_id, "GEARBOX")
    rng = random.Random(_get_seed(turbine_id, "GEARBOX") + 2)

    history: list[OilAnalysisPoint] = []
    now = datetime.now(UTC)

    for month in range(12, 0, -1):
        ts = now.replace(month=((now.month - month - 1) % 12) + 1)
        month_hi = min(100.0, hi + month * 0.5)  # older = slightly better
        iso = BASELINE_OIL_CODE if month_hi > 80 else ("17/15/12" if month_hi > 60 else "18/16/13")
        history.append(
            OilAnalysisPoint(
                timestamp_utc=ts,
                iso_code=iso,
                particle_count_4um=rng.randint(1000, 3000),
                particle_count_6um=rng.randint(300, 800),
                particle_count_14um=rng.randint(50, 150),
                viscosity_cst=round(rng.uniform(95.0, 105.0), 1),
                water_ppm=round(rng.uniform(20.0, 150.0), 1),
            )
        )

    water_alert = history[-1].water_ppm > 200.0
    current_iso = history[-1].iso_code if history else BASELINE_OIL_CODE

    if hi < 60.0:
        recommendation = "Immediate oil change + particle analysis"
    elif hi < 80.0:
        recommendation = "Oil change at next scheduled service (within 3 months)"
    else:
        recommendation = "Normal interval — next change at 6-month service"

    return OilAnalysisResponse(
        turbine_id=turbine_id,
        component="GEARBOX",
        history=history,
        current_iso_code=current_iso,
        water_ingress_alert=water_alert,
        next_oil_change_recommendation=recommendation,
    )


def get_active_alerts() -> list[CMSAlertResponse]:
    """Return all active CMS alerts (non-GREEN, non-YELLOW components)."""
    from app.models.cms import CMS_COMPONENTS

    alerts = []
    for n in range(1, N_TURBINES + 1):
        turbine_id = f"WTG-{n:02d}"
        for component in CMS_COMPONENTS:
            hi = _compute_current_hi(turbine_id, component)
            level = _hi_to_alert_level(hi)
            if level in ("GREEN", "YELLOW"):
                continue

            vib = _hi_to_vib(hi)
            temp = _hi_to_temp(component, hi)
            rul = _estimate_rul(turbine_id, component)

            if level == "CRITICAL":
                action = "IMMEDIATE SHUTDOWN — schedule emergency maintenance"
            elif level == "RED":
                action = "Inspect within 7 days — arrange vessel and parts"
            else:
                action = "Inspect within 30 days at next scheduled maintenance visit"

            alerts.append(
                CMSAlertResponse(
                    id=_alert_uuid(turbine_id, component),
                    turbine_id=turbine_id,
                    component=component,
                    alert_level=level,
                    health_index=hi,
                    rul_days=rul,
                    vib_rms_mm_s=round(vib, 2),
                    temp_celsius=temp,
                    description=(
                        f"{turbine_id} {component}: HI={hi:.0f}, "
                        f"vib={vib:.1f} mm/s (ISO Zone {'D' if vib > VIB_ZONE_C else 'C'})"
                    ),
                    recommended_action=action,
                    resolved=False,
                    created_at=datetime.now(UTC),
                )
            )
    return alerts


def _alert_uuid(turbine_id: str, component: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"cms-alert-{turbine_id}-{component}")


def inject_degradation(
    turbine_id: str,
    body: FaultInjectionRequest,
) -> FaultInjectionResponse:
    """Inject a simulated degradation fault for training scenarios.

    Sets the component on an accelerated degradation trajectory starting
    from its current health index.
    """
    component = body.component
    severity = body.severity

    rate = body.degradation_rate or DEGRADATION_RATES.get(severity, 2.0)
    current_hi = _compute_current_hi(turbine_id, component)

    _injected_faults.setdefault(turbine_id, {})[component] = {
        "rate": rate,
        "start_hi": current_hi,
        "start_time": datetime.now(UTC).timestamp(),
    }

    days_to_amber = max(0.0, (current_hi - 60.0) / rate) if current_hi > 60.0 else 0.0
    days_to_red = max(0.0, (current_hi - 40.0) / rate) if current_hi > 40.0 else 0.0
    days_to_crit = max(0.0, (current_hi - 20.0) / rate) if current_hi > 20.0 else 0.0

    return FaultInjectionResponse(
        turbine_id=turbine_id,
        component=component,
        severity=severity,
        degradation_rate_per_day=rate,
        initial_health_index=current_hi,
        current_health_index=current_hi,
        estimated_days_to_amber=round(days_to_amber, 1),
        estimated_days_to_red=round(days_to_red, 1),
        estimated_days_to_critical=round(days_to_crit, 1),
        message=(
            f"Fault injected on {turbine_id}/{component}. "
            f"HI will degrade from {current_hi:.0f} at {rate:.1f} pts/day. "
            f"Expected AMBER in {days_to_amber:.0f} days."
        ),
    )


def clear_fault_injection(turbine_id: str, component: str | None = None) -> int:
    """Remove injected faults. Returns number of faults cleared."""
    cleared = 0
    if turbine_id not in _injected_faults:
        return 0
    if component:
        if component in _injected_faults[turbine_id]:
            del _injected_faults[turbine_id][component]
            cleared = 1
    else:
        cleared = len(_injected_faults[turbine_id])
        del _injected_faults[turbine_id]
    return cleared
