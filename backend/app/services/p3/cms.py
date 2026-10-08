"""
Condition Monitoring System (CMS) service — M12.

Component health, vibration spectra, hydraulic-oil analysis and degradation
injection for the 34 × 15 MW fleet (SB-510, IEA 15 MW reference turbine — a
low-speed direct drive: no gearbox).

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
component-specific zones for wind turbines (bearing, generator, nacelle) and
frequency bands; a production CMS would apply those.

Drivetrain kinematics (IEA 15 MW at rated speed, Gaertner et al. 2020)
-----------------------------------------------------------------------
Rotor 7.56 rpm → f_r = 0.126 Hz. Direct drive: the 200-pole PMSG turns with the
rotor on the two main bearings (Table 5-2: upwind tapered double outer-ring
bearing, locating; downwind spherical roller bearing, non-locating), so there are
no gear-mesh frequencies. Generator lines (Table 5-4: 100 pole pairs, 240 slots):

  electrical frequency  f_e  = 100 · f_r = 12.6 Hz
  magnetic pull         2 f_e            = 25.2 Hz (eccentricity, magnet damage)
  slot passing          240 · f_r        = 30.2 Hz

Bearing defect frequencies (n rolling elements per row, d/D, contact angle α):
  BPFO = n/2 · f · (1 − d/D·cos α),   BPFI = n/2 · f · (1 + d/D·cos α)
Roller counts and d/D are ASSUMED (OEM data is confidential), sized for the
6 m main shaft: upwind TDO n 60, d/D 0.05, α 15° → BPFO 3.6 Hz; downwind SRB
n 40, d/D 0.08, α 10° → BPFO 2.3 Hz. Bearing spectra are taken over 0–12 Hz at
0.03 Hz resolution (3×BPFO 10.8 Hz), the generator over 0–40 Hz at 0.1 Hz.

The hydraulic pitch/brake unit is the oil-filled system: its ISO VG 46 oil
(ISO 3448: 41.4–50.6 cSt at 40 °C) is sampled for ISO 4406 cleanliness.
Baseline temperatures are illustrative; the generator's 92 °C is the stator
winding at rated load from the nacelle thermal model.

Standards: ISO 10816-3, ISO 10816-21, ISO 13373, ISO 13381-1, ISO 4406, ISO 3448.
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
from app.services.p1.turbine_models import rosco
from app.services.turbine_physics.drivetrain import GENERATOR_POLES
from app.services.turbine_physics.rotor_dynamics import MAX_ROTOR_SPEED_RPM

# ── Configuration ─────────────────────────────────────────────────

N_TURBINES: int = 34
CMS_COMPONENTS: tuple[str, ...] = ("MAIN_BEARING", "REAR_BEARING", "GENERATOR", "PITCH", "YAW")
# Pitch and yaw move slowly and intermittently — monitored through hydraulic
# pressure / motor current, not vibration spectra.
VIBRATION_COMPONENTS: tuple[str, ...] = ("MAIN_BEARING", "REAR_BEARING", "GENERATOR")

# ISO 10816-3 group 2 (rigid) velocity zones [mm/s]
VIB_ZONE_A: float = 2.3
VIB_ZONE_B: float = 4.5
VIB_ZONE_C: float = 7.1

# Drivetrain (see module docstring)
ROTOR_RPM_RATED: float = MAX_ROTOR_SPEED_RPM  # 7.56 rpm, ROSCO PC_RefSpd
F_ROTOR: float = ROTOR_RPM_RATED / 60.0
POLE_PAIRS: int = GENERATOR_POLES // 2  # 100
STATOR_SLOTS: int = int(rosco()[1].report["generator"]["stator_slots"])  # 240
# (rolling elements, d/D, contact angle °) — ASSUMED, see module docstring
BEARINGS: dict[str, tuple[int, float, float]] = {
    "MAIN_BEARING": (60, 0.05, 15.0),
    "REAR_BEARING": (40, 0.08, 10.0),
}

ALERT_THRESHOLDS: dict[str, float] = {"CRITICAL": 20.0, "RED": 40.0, "AMBER": 60.0, "YELLOW": 80.0}
DEGRADATION_RATES: dict[str, float] = {"MINOR": 0.5, "MODERATE": 2.0, "SEVERE": 5.0}
NOMINAL_RATE: float = 0.05  # healthy wear [HI points/day]

BASELINE_TEMPS: dict[str, float] = {
    "MAIN_BEARING": 45.0,
    "REAR_BEARING": 45.0,
    "GENERATOR": 92.0,  # stator winding at rated, 15 °C ambient (nacelle thermal model)
    "PITCH": 35.0,  # hydraulic oil
    "YAW": 40.0,
}
BASELINE_OIL_CODE: str = "16/14/11"
TARGET_OIL_CODE: str = "17/15/12"  # hydraulic system limit (ISO 4406)
OIL_VISCOSITY_CST: float = 46.0  # ISO VG 46 hydraulic oil at 40 °C (ISO 3448)

# Training fleet: a few components with known, explainable degradation.
# Everything else starts healthy (HI 86–99).
SEEDED_DEGRADATION: dict[tuple[str, str], tuple[float, str]] = {
    ("WTG-07", "MAIN_BEARING"): (64.0, "early outer-race spalling — BPFO and harmonics"),
    ("WTG-21", "GENERATOR"): (52.0, "rotor eccentricity — 2·f_e magnetic pull with 1× sidebands"),
    ("WTG-29", "REAR_BEARING"): (73.0, "downwind bearing outer-race wear — BPFO"),
}

# Injected faults: {turbine_id: {component: {rate, start_hi, start_time}}}
# ponytail: keyed by turbine ID only — WTG-03 of every farm shares one fault;
# key by (farm, turbine) if two farms are trained on at the same time.
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
    if component == "PITCH":
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


def get_fleet_health(n_turbines: int = N_TURBINES) -> FleetHealthResponse:
    """Health of every turbine (SB-510: 34), with the per-component HI for the heatmap."""
    summaries: list[TurbineHealthSummary] = []
    for n in range(1, n_turbines + 1):
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
        fleet_average_hi=round(sum(s.overall_health_index for s in summaries) / n_turbines, 1),
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
    """Kinematic / electrical fault frequencies [Hz] at rated speed for one component."""
    if component in BEARINGS:
        n, d_ratio, alpha = BEARINGS[component]
        bpfo, bpfi = _bearing(n, d_ratio, alpha, F_ROTOR)
        return [
            ("1× rotor", F_ROTOR),
            ("BPFO", bpfo),
            ("BPFI", bpfi),
            ("2×BPFO", 2 * bpfo),
            ("3×BPFO", 3 * bpfo),
        ]
    if component == "GENERATOR":
        f_e = POLE_PAIRS * F_ROTOR
        return [
            ("1× rotor", F_ROTOR),
            ("f_e", f_e),
            ("2·f_e", 2 * f_e),
            ("slot pass", STATOR_SLOTS * F_ROTOR),
        ]
    raise ValueError(f"No vibration spectrum for {component}")


def get_vibration_spectrum(turbine_id: str, component: str) -> VibrationSpectrumResponse:
    """Simulated velocity spectrum (400 lines) whose overall RMS equals the HI vibration.

    Healthy: 1× running-speed peak + broadband floor (+ electrical lines for the
    generator). Degraded (HI < 80): the defect frequency of the seeded/injected
    failure mode grows — bearing BPFO with harmonics, or the generator's 2·f_e
    magnetic-pull line with ±1× sidebands (eccentricity).
    """
    if component not in VIBRATION_COMPONENTS:
        raise ValueError(
            f"{component} has no vibration CMS (slow, intermittent motion) — "
            "it is monitored through hydraulic pressure / motor current"
        )
    hi = _compute_current_hi(turbine_id, component)
    rng = random.Random(_seed(turbine_id, component) + 1)
    marks = characteristic_frequencies(component)
    f_max = 12.0 if component in BEARINGS else 40.0
    df = f_max / 400
    freqs = [(i + 1) * df for i in range(400)]
    severity = max(0.0, (80.0 - hi) / 80.0)  # 0 healthy … 1 failed
    # Once a defect exists (HI < 80) its peak outgrows the 1× running-speed line
    defect = 1.0 + 5.0 * severity if severity > 0 else 0.0

    peaks: list[tuple[float, float]] = [(marks[0][1], 1.0)]  # 1× running speed
    if component == "GENERATOR":
        lines = dict(marks)
        peaks += [(lines["f_e"], 0.3), (lines["2·f_e"], 0.6), (lines["slot pass"], 0.4)]
        peaks.append((lines["2·f_e"], defect))
        peaks += [(lines["2·f_e"] + s * F_ROTOR, 0.5 * defect) for s in (-1, 1)]
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
    """Hydraulic pitch/brake oil samples, monthly over 12 months (oldest first).

    Direct drive: no gearbox oil. The hydraulic unit (ISO VG 46) is the oil system
    whose cleanliness (ISO 4406) protects the pitch proportional valves.
    """
    hi = _compute_current_hi(turbine_id, "PITCH")
    rng = random.Random(_seed(turbine_id, "PITCH") + 2)
    now = datetime.now(UTC)
    history: list[OilAnalysisPoint] = []
    for months_ago in range(11, -1, -1):
        sample_hi = min(100.0, hi + months_ago * 30 * _rate(turbine_id, "PITCH"))
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
        recommendation = "Flush, change oil and filters now; inspect pitch valves and cylinders"
    elif hi < 80.0:
        recommendation = "Filter change and offline filtration at the next service (≤ 3 months)"
    else:
        recommendation = "Normal interval — next sample at the annual service"

    return OilAnalysisResponse(
        turbine_id=turbine_id,
        component="PITCH",
        history=history,
        current_iso_code=history[-1].iso_code,
        target_iso_code=TARGET_OIL_CODE,
        water_ingress_alert=history[-1].water_ppm > 200.0,
        next_oil_change_recommendation=recommendation,
    )


def get_active_alerts(n_turbines: int = N_TURBINES) -> list[CMSAlertResponse]:
    """All AMBER / RED / CRITICAL components across the fleet."""
    alerts = []
    for n in range(1, n_turbines + 1):
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
