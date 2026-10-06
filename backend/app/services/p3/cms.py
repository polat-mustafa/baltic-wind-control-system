"""
Condition Monitoring System (CMS) service — M12.

Component health, vibration spectra, oil analysis and degradation injection
for the 34 × V236-15.0 MW fleet.

Health Index Model (simplified ISO 13381-1)
--------------------------------------------
The health index (HI) tracks condition from 100 (new) to 0 (failed) and
falls linearly with an injected degradation rate [points/day]; the remaining
useful life is RUL = HI / rate. A healthy component loses ~0.05 points/day
(≈ 5 years from 100 to the AMBER boundary).

Vibration severity
-------------------
Velocity RMS zones of ISO 10816-3 (group 2, rigid support), used as generic
thresholds: A/B 2.3 mm/s, B/C 4.5 mm/s, C/D 7.1 mm/s. ISO 10816-21 defines
component-specific zones for wind turbines (bearing, gearbox, generator,
nacelle) and frequency bands; a production CMS would apply those.

Drivetrain kinematics (V236 at rated speed)
--------------------------------------------
Rotor 8.33 rpm → f_r = 0.139 Hz; 3-stage planetary gearbox 48:1 → generator
400 rpm (f_g = 6.66 Hz), matching services/turbine_physics. Tooth and rolling-
element counts are ASSUMED (OEM data is confidential) but chosen so the
stage ratios multiply to 48 (planetary ratio 1 + Z_ring / Z_sun, ring fixed):

  stage 1: Z_sun 21, Z_ring 63 → 4.0   GMF1 = 63 · f_r          = 8.75 Hz
  stage 2: Z_sun 24, Z_ring 72 → 4.0   GMF2 = 72 · 4 f_r        = 40.0 Hz
  stage 3: Z_sun 30, Z_ring 60 → 3.0   GMF3 = 60 · 16 f_r       = 133 Hz

Bearing defect frequencies (n rolling elements, d/D, contact angle α):
  BPFO = n/2 · f · (1 − d/D·cos α),   BPFI = n/2 · f · (1 + d/D·cos α)
Main bearing (spherical roller, n 22, d/D 0.10, α 10°): BPFO 1.38 Hz,
BPFI 1.68 Hz — far below 10 Hz, so the main-bearing spectrum is taken over
0–10 Hz at 0.025 Hz resolution (a 0–500 Hz / 2.5 Hz spectrum cannot show it).

Standards: ISO 10816-3, ISO 10816-21, ISO 13373, ISO 13381-1, ISO 4406.
"""

from __future__ import annotations

import math
import random
import uuid
import zlib
from datetime import UTC, datetime, timedelta

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

# ── Configuration ─────────────────────────────────────────────────

N_TURBINES: int = 34
CMS_COMPONENTS: tuple[str, ...] = ("MAIN_BEARING", "GEARBOX", "GENERATOR", "PITCH", "YAW")
# Pitch and yaw move slowly and intermittently — monitored through hydraulic
# pressure / motor current, not vibration spectra.
VIBRATION_COMPONENTS: tuple[str, ...] = ("MAIN_BEARING", "GEARBOX", "GENERATOR")

# ISO 10816-3 group 2 (rigid) velocity zones [mm/s]
VIB_ZONE_A: float = 2.3
VIB_ZONE_B: float = 4.5
VIB_ZONE_C: float = 7.1

# Drivetrain (see module docstring)
ROTOR_RPM_RATED: float = 8.33
GEARBOX_RATIO: float = 48.0
F_ROTOR: float = ROTOR_RPM_RATED / 60.0
STAGES: tuple[tuple[int, int], ...] = ((21, 63), (24, 72), (30, 60))  # (Z_sun, Z_ring)

ALERT_THRESHOLDS: dict[str, float] = {"CRITICAL": 20.0, "RED": 40.0, "AMBER": 60.0, "YELLOW": 80.0}
DEGRADATION_RATES: dict[str, float] = {"MINOR": 0.5, "MODERATE": 2.0, "SEVERE": 5.0}
NOMINAL_RATE: float = 0.05  # healthy wear [HI points/day]

BASELINE_TEMPS: dict[str, float] = {
    "MAIN_BEARING": 45.0,
    "GEARBOX": 65.0,
    "GENERATOR": 80.0,
    "PITCH": 35.0,
    "YAW": 40.0,
}
BASELINE_OIL_CODE: str = "16/14/11"
TARGET_OIL_CODE: str = "17/15/12"  # gearbox OEM limit (ISO 4406)
OIL_VISCOSITY_CST: float = 320.0  # ISO VG 320 gear oil at 40 °C

# Training fleet: a few components with known, explainable degradation.
# Everything else starts healthy (HI 86–99).
SEEDED_DEGRADATION: dict[tuple[str, str], tuple[float, str]] = {
    ("WTG-07", "MAIN_BEARING"): (64.0, "early outer-race spalling — BPFO and harmonics"),
    ("WTG-21", "GEARBOX"): (52.0, "stage-3 tooth wear — GMF3 harmonics with carrier sidebands"),
    ("WTG-29", "GENERATOR"): (73.0, "drive-end bearing wear — generator BPFO"),
}

# Injected faults: {turbine_id: {component: {rate, start_hi, start_time}}}
_injected_faults: dict[str, dict[str, dict[str, float]]] = {}


# ── Health model ──────────────────────────────────────────────────


def _seed(turbine_id: str, component: str) -> int:
    """Stable across processes (Python's hash() of str is salted per run)."""
    return zlib.crc32(f"{turbine_id}-{component}".encode())


def _hi_to_alert_level(hi: float) -> str:
    for level in ("CRITICAL", "RED", "AMBER", "YELLOW"):
        if hi < ALERT_THRESHOLDS[level]:
            return level
    return "GREEN"


def _hi_to_vib(hi: float) -> float:
    """Health index → velocity RMS [mm/s], piecewise linear across the zones."""
    if hi >= 80.0:
        return 0.5 + (100.0 - hi) / 20.0 * (VIB_ZONE_A - 0.5)
    if hi >= 60.0:
        return VIB_ZONE_A + (80.0 - hi) / 20.0 * (VIB_ZONE_B - VIB_ZONE_A)
    if hi >= 30.0:
        return VIB_ZONE_B + (60.0 - hi) / 30.0 * (VIB_ZONE_C - VIB_ZONE_B)
    return VIB_ZONE_C + (30.0 - hi) / 30.0 * (15.0 - VIB_ZONE_C)


def _hi_to_temp(component: str, hi: float) -> float:
    """Friction losses rise as the component wears: +30 °C at end of life."""
    return round(BASELINE_TEMPS.get(component, 50.0) + (100.0 - hi) / 100.0 * 30.0, 1)


def _baseline_hi(turbine_id: str, component: str) -> float:
    seeded = SEEDED_DEGRADATION.get((turbine_id, component))
    if seeded:
        return seeded[0]
    return 86.0 + random.Random(_seed(turbine_id, component)).uniform(0.0, 13.0)


def _compute_current_hi(turbine_id: str, component: str) -> float:
    fault = _injected_faults.get(turbine_id, {}).get(component)
    if fault is None:
        return round(_baseline_hi(turbine_id, component), 1)
    elapsed_days = (datetime.now(UTC).timestamp() - fault["start_time"]) / 86400.0
    return round(max(0.0, fault["start_hi"] - fault["rate"] * elapsed_days), 1)


def _rate(turbine_id: str, component: str) -> float:
    fault = _injected_faults.get(turbine_id, {}).get(component)
    if fault:
        return fault["rate"]
    seeded = SEEDED_DEGRADATION.get((turbine_id, component))
    return 0.15 if seeded else NOMINAL_RATE  # a known defect progresses faster


def _estimate_rul(turbine_id: str, component: str) -> float:
    """Days until HI reaches 0 at the current degradation rate."""
    return round(_compute_current_hi(turbine_id, component) / _rate(turbine_id, component), 1)


def _compute_component_health(turbine_id: str, component: str) -> ComponentHealthSchema:
    hi = _compute_current_hi(turbine_id, component)
    if component == "GEARBOX":
        oil = "18/16/13" if hi < 60.0 else "17/15/12" if hi < 80.0 else BASELINE_OIL_CODE
    else:
        oil = BASELINE_OIL_CODE
    return ComponentHealthSchema(
        component=component,
        health_index=hi,
        alert_level=_hi_to_alert_level(hi),
        vib_rms_mm_s=round(_hi_to_vib(hi), 2),
        temp_celsius=_hi_to_temp(component, hi),
        oil_iso_code=oil,
        rul_days=_estimate_rul(turbine_id, component),
        last_updated=datetime.now(UTC),
    )


# ── Public service functions ──────────────────────────────────────


def get_turbine_health(turbine_id: str) -> TurbineHealthResponse:
    """Per-component health of one turbine; overall = worst component."""
    components = [_compute_component_health(turbine_id, c) for c in CMS_COMPONENTS]
    worst_hi = min(c.health_index for c in components)
    return TurbineHealthResponse(
        turbine_id=turbine_id,
        overall_health_index=round(worst_hi, 1),
        overall_alert_level=_hi_to_alert_level(worst_hi),
        components=components,
        active_alerts=sum(1 for c in components if c.alert_level not in ("GREEN", "YELLOW")),
        last_updated=datetime.now(UTC),
    )


def get_fleet_health() -> FleetHealthResponse:
    """Health of all 34 turbines, with the per-component HI for the heatmap."""
    summaries: list[TurbineHealthSummary] = []
    for n in range(1, N_TURBINES + 1):
        turbine_id = f"WTG-{n:02d}"
        components = [_compute_component_health(turbine_id, c) for c in CMS_COMPONENTS]
        worst = min(components, key=lambda c: c.health_index)
        summaries.append(
            TurbineHealthSummary(
                turbine_id=turbine_id,
                overall_health_index=worst.health_index,
                overall_alert_level=worst.alert_level,
                worst_component=worst.component,
                active_alerts=sum(
                    1 for c in components if c.alert_level not in ("GREEN", "YELLOW")
                ),
                component_health={c.component: c.health_index for c in components},
            )
        )

    return FleetHealthResponse(
        turbines=summaries,
        fleet_average_hi=round(sum(s.overall_health_index for s in summaries) / N_TURBINES, 1),
        turbines_in_warning=sum(
            1 for s in summaries if s.overall_alert_level in ("RED", "CRITICAL")
        ),
        turbines_in_alert=sum(1 for s in summaries if s.overall_alert_level == "AMBER"),
        active_alerts_total=sum(s.active_alerts for s in summaries),
        timestamp_utc=datetime.now(UTC),
    )


def _bearing(n: int, d_ratio: float, alpha_deg: float, f_shaft: float) -> tuple[float, float]:
    """(BPFO, BPFI) [Hz] of a rolling bearing on a shaft turning at f_shaft."""
    k = d_ratio * math.cos(math.radians(alpha_deg))
    return n / 2 * f_shaft * (1 - k), n / 2 * f_shaft * (1 + k)


def characteristic_frequencies(component: str) -> list[tuple[str, float]]:
    """Kinematic fault frequencies [Hz] at rated speed for one component."""
    if component == "MAIN_BEARING":
        bpfo, bpfi = _bearing(22, 0.10, 10.0, F_ROTOR)
        return [
            ("1× rotor", F_ROTOR),
            ("BPFO", bpfo),
            ("BPFI", bpfi),
            ("2×BPFO", 2 * bpfo),
            ("3×BPFO", 3 * bpfo),
        ]
    if component == "GEARBOX":
        out: list[tuple[str, float]] = []
        f_carrier = F_ROTOR
        for i, (z_sun, z_ring) in enumerate(STAGES, start=1):
            out.append((f"GMF{i}", z_ring * f_carrier))
            f_carrier *= 1 + z_ring / z_sun  # sun of this stage drives the next carrier
        out.append(("1× HSS", f_carrier))
        return out
    if component == "GENERATOR":
        f_gen = F_ROTOR * GEARBOX_RATIO
        bpfo, bpfi = _bearing(12, 0.20, 0.0, f_gen)
        return [("1× gen", f_gen), ("2× gen", 2 * f_gen), ("BPFO", bpfo), ("BPFI", bpfi)]
    raise ValueError(f"No vibration spectrum for {component}")


def get_vibration_spectrum(turbine_id: str, component: str) -> VibrationSpectrumResponse:
    """Simulated velocity spectrum (400 lines) whose overall RMS equals the HI vibration.

    Healthy: 1× running-speed peak + broadband floor (+ gear mesh for the
    gearbox). Degraded (HI < 80): the defect frequency of the seeded/injected
    failure mode grows with harmonics (and carrier sidebands for gear wear).
    """
    if component not in VIBRATION_COMPONENTS:
        raise ValueError(
            f"{component} has no vibration CMS (slow, intermittent motion) — "
            "it is monitored through hydraulic pressure / motor current"
        )
    hi = _compute_current_hi(turbine_id, component)
    rng = random.Random(_seed(turbine_id, component) + 1)
    marks = characteristic_frequencies(component)
    f_max = 10.0 if component == "MAIN_BEARING" else 200.0
    df = f_max / 400
    freqs = [(i + 1) * df for i in range(400)]
    severity = max(0.0, (80.0 - hi) / 80.0)  # 0 healthy … 1 failed
    # Once a defect exists (HI < 80) its peak outgrows the 1× running-speed line
    defect = 1.0 + 5.0 * severity if severity > 0 else 0.0

    peaks: list[tuple[float, float]] = [(marks[0][1], 1.0)]  # 1× running speed
    if component == "GEARBOX":
        peaks += [(f, 0.6) for name, f in marks if name.startswith("GMF")]
        f_c3 = F_ROTOR * 16  # stage-3 carrier
        gmf3 = marks[2][1]
        for h in (1, 2, 3):
            peaks.append((h * gmf3, defect / h))
            peaks += [(h * gmf3 + s * f_c3, 0.5 * defect / h) for s in (-1, 1)]
    else:
        bpfo = dict(marks)["BPFO"]
        peaks += [(h * bpfo, defect / h) for h in (1, 2, 3)]

    amps = [0.04 + rng.uniform(0.0, 0.03) for _ in freqs]
    for f_peak, a in peaks:
        i = round(f_peak / df) - 1
        if 0 <= i < len(amps):
            amps[i] += a
    # Scale so the overall RMS √Σa² matches the health-index vibration level
    scale = _hi_to_vib(hi) / math.sqrt(sum(a * a for a in amps))
    amps = [a * scale for a in amps]
    i_dom = max(range(len(amps)), key=amps.__getitem__)

    return VibrationSpectrumResponse(
        turbine_id=turbine_id,
        component=component,
        timestamp_utc=datetime.now(UTC),
        points=[
            FFTPoint(frequency_hz=round(f, 4), amplitude_mm_s=round(a, 4))
            for f, a in zip(freqs, amps, strict=True)
        ],
        dominant_frequency_hz=round(freqs[i_dom], 3),
        dominant_amplitude_mm_s=round(amps[i_dom], 4),
        overall_rms_mm_s=round(_hi_to_vib(hi), 2),
        resolution_hz=df,
        fault_frequency_markers=[{"freq_hz": round(f, 3), "label": name} for name, f in marks],
    )


def get_oil_analysis(turbine_id: str) -> OilAnalysisResponse:
    """Gearbox oil samples, monthly over the last 12 months (oldest first)."""
    hi = _compute_current_hi(turbine_id, "GEARBOX")
    rng = random.Random(_seed(turbine_id, "GEARBOX") + 2)
    now = datetime.now(UTC)
    history: list[OilAnalysisPoint] = []
    for months_ago in range(11, -1, -1):
        sample_hi = min(100.0, hi + months_ago * 30 * _rate(turbine_id, "GEARBOX"))
        wear = max(0.0, (90.0 - sample_hi) / 90.0)  # particle counts rise with wear
        iso = BASELINE_OIL_CODE if sample_hi > 80 else "17/15/12" if sample_hi > 60 else "18/16/13"
        history.append(
            OilAnalysisPoint(
                timestamp_utc=now - timedelta(days=30 * months_ago),
                iso_code=iso,
                particle_count_4um=int(rng.uniform(320, 640) * (1 + 6 * wear)),
                particle_count_6um=int(rng.uniform(80, 160) * (1 + 6 * wear)),
                particle_count_14um=int(rng.uniform(10, 20) * (1 + 6 * wear)),
                viscosity_cst=round(OIL_VISCOSITY_CST * rng.uniform(0.96, 1.03), 1),
                water_ppm=round(rng.uniform(60.0, 180.0), 1),
            )
        )

    if hi < 60.0:
        recommendation = "Oil change and filter replacement now; send sample for ferrography"
    elif hi < 80.0:
        recommendation = "Oil change at the next scheduled service (within 3 months)"
    else:
        recommendation = "Normal interval — next oil change at the annual service"

    return OilAnalysisResponse(
        turbine_id=turbine_id,
        component="GEARBOX",
        history=history,
        current_iso_code=history[-1].iso_code,
        target_iso_code=TARGET_OIL_CODE,
        water_ingress_alert=history[-1].water_ppm > 200.0,
        next_oil_change_recommendation=recommendation,
    )


def get_active_alerts() -> list[CMSAlertResponse]:
    """All AMBER / RED / CRITICAL components across the fleet."""
    alerts = []
    for n in range(1, N_TURBINES + 1):
        turbine_id = f"WTG-{n:02d}"
        for component in CMS_COMPONENTS:
            hi = _compute_current_hi(turbine_id, component)
            level = _hi_to_alert_level(hi)
            if level in ("GREEN", "YELLOW"):
                continue
            vib = _hi_to_vib(hi)
            zone = "D" if vib > VIB_ZONE_C else "C" if vib > VIB_ZONE_B else "B"
            seeded = SEEDED_DEGRADATION.get((turbine_id, component))
            action = {
                "CRITICAL": "Stop the turbine — emergency maintenance",
                "RED": "Inspect within 7 days — arrange vessel and parts",
            }.get(level, "Inspect within 30 days at the next scheduled visit")
            alerts.append(
                CMSAlertResponse(
                    id=uuid.uuid5(uuid.NAMESPACE_DNS, f"cms-alert-{turbine_id}-{component}"),
                    turbine_id=turbine_id,
                    component=component,
                    alert_level=level,
                    health_index=hi,
                    rul_days=_estimate_rul(turbine_id, component),
                    vib_rms_mm_s=round(vib, 2),
                    temp_celsius=_hi_to_temp(component, hi),
                    description=(
                        f"{turbine_id} {component}: HI {hi:.0f}, {vib:.1f} mm/s (zone {zone})"
                        + (f" — {seeded[1]}" if seeded else "")
                    ),
                    recommended_action=action,
                    resolved=False,
                    created_at=datetime.now(UTC),
                )
            )
    return alerts


def inject_degradation(turbine_id: str, body: FaultInjectionRequest) -> FaultInjectionResponse:
    """Put a component on an accelerated degradation trajectory (training)."""
    component = body.component
    rate = body.degradation_rate or DEGRADATION_RATES.get(body.severity, 2.0)
    current_hi = _compute_current_hi(turbine_id, component)
    _injected_faults.setdefault(turbine_id, {})[component] = {
        "rate": rate,
        "start_hi": current_hi,
        "start_time": datetime.now(UTC).timestamp(),
    }

    def days_to(level: float) -> float:
        return round(max(0.0, (current_hi - level) / rate), 1)

    return FaultInjectionResponse(
        turbine_id=turbine_id,
        component=component,
        severity=body.severity,
        degradation_rate_per_day=rate,
        initial_health_index=current_hi,
        current_health_index=current_hi,
        estimated_days_to_amber=days_to(60.0),
        estimated_days_to_red=days_to(40.0),
        estimated_days_to_critical=days_to(20.0),
        message=(
            f"{turbine_id}/{component} degrading from HI {current_hi:.0f} at {rate:.1f} pts/day: "
            f"AMBER in {days_to(60.0):.0f} d, RED in {days_to(40.0):.0f} d."
        ),
    )


def clear_fault_injection(turbine_id: str, component: str | None = None) -> int:
    """Remove injected faults. Returns the number cleared."""
    faults = _injected_faults.get(turbine_id)
    if not faults:
        return 0
    if component:
        return 1 if faults.pop(component, None) is not None else 0
    return len(_injected_faults.pop(turbine_id))
