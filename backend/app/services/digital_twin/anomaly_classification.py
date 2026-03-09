"""Anomaly classification — rule-based pattern matching on residuals.

Physics Layer
─────────────
Different fault types produce distinct residual signatures across the
power, rotor speed, and pitch channels. By examining which channels
deviate and in which direction, we can classify the root cause.

Standards Layer
───────────────
- ISO 13374-1 Level 5: Prognostics (when combined with trending)
- ISO 13379-1: Interpretation of condition monitoring data
- IEC 61400-25-6: Condition monitoring information model

Maths Layer
───────────
Classification rules based on EWMA residual signatures:

| Fault Type      | Power EWMA | RPM EWMA  | Pitch EWMA | Physics Reason                    |
|─────────────────|────────────|───────────|────────────|───────────────────────────────────|
| Aerodynamic     | < -15%     | < -10%    | any        | Blade damage/icing → less lift    |
| Mechanical      | < -15%     | ±normal   | any        | Drivetrain loss → less conversion |
| Electrical      | > -10%     | > +5%     | > +5°      | Generator limit → rotor speeds up |
| Control         | ±variable  | ±variable | > ±15%     | Pitch system fault → dominant     |
| Sensor drift    | > +10%     | ±normal   | ±normal    | Anemometer reads high → P > twin  |

Thresholds are empirical from wind farm SCADA literature (Tautz-Weinert &
Watson, 2017, "Using SCADA data for wind turbine condition monitoring").

Code Layer
──────────
Pure functions that classify based on scalar EWMA values.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np
from numpy.typing import NDArray

# ── Constants ─────────────────────────────────────────────────────

# Classification thresholds (percentage)
POWER_LOW_THRESHOLD = -15.0
POWER_HIGH_THRESHOLD = 10.0
RPM_LOW_THRESHOLD = -10.0
RPM_HIGH_THRESHOLD = 5.0
PITCH_DOMINANT_THRESHOLD = 15.0
ANOMALY_MIN_THRESHOLD = 8.0  # Minimum EWMA magnitude to flag


# ── Data containers ──────────────────────────────────────────────


class AnomalyCategory(str, Enum):  # noqa: UP042 — StrEnum requires Python 3.11+
    """Root cause categories for turbine anomalies."""

    AERODYNAMIC = "aerodynamic"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    CONTROL = "control"
    SENSOR_DRIFT = "sensor_drift"
    NORMAL = "normal"


CATEGORY_DESCRIPTIONS: dict[AnomalyCategory, str] = {
    AnomalyCategory.AERODYNAMIC: (
        "Blade icing or damage — reduced lift → lower power and rotor speed"
    ),
    AnomalyCategory.MECHANICAL: (
        "Drivetrain degradation — gearbox/bearing loss → lower power, normal rotor"
    ),
    AnomalyCategory.ELECTRICAL: (
        "Generator derating — power capped → rotor overspeeds, pitch compensates"
    ),
    AnomalyCategory.CONTROL: (
        "Pitch/yaw malfunction — control residual dominant → erratic operation"
    ),
    AnomalyCategory.SENSOR_DRIFT: ("Anemometer drift — wind reads high → apparent overperformance"),
    AnomalyCategory.NORMAL: "Normal operation — residuals within expected noise bounds",
}


@dataclass(frozen=True)
class AnomalyRecord:
    """Single anomaly detection record for one turbine at one timestep."""

    turbine_id: int
    timestep: int
    category: AnomalyCategory
    severity: str  # "low", "medium", "high"
    description: str
    power_ewma_pct: float
    rpm_ewma_pct: float
    pitch_ewma_pct: float


# ── Core functions ───────────────────────────────────────────────


def classify_single(
    power_ewma_pct: float,
    rpm_ewma_pct: float,
    pitch_ewma_pct: float,
) -> AnomalyCategory:
    """Classify anomaly category from EWMA residual signature.

    Decision tree based on which channels deviate and direction:
    1. If pitch residual dominant → Control fault
    2. If power low AND rotor slow → Aerodynamic fault
    3. If power low AND rotor normal → Mechanical fault
    4. If power normal AND rotor fast AND pitch high → Electrical fault
    5. If power high → Sensor drift
    6. Otherwise → Normal
    """
    power_mag = abs(power_ewma_pct)
    rpm_mag = abs(rpm_ewma_pct)
    pitch_mag = abs(pitch_ewma_pct)

    # Check if any channel exceeds noise floor
    if max(power_mag, rpm_mag, pitch_mag) < ANOMALY_MIN_THRESHOLD:
        return AnomalyCategory.NORMAL

    # 1. Control fault: pitch residual dominates
    if pitch_mag > PITCH_DOMINANT_THRESHOLD and pitch_mag > power_mag:
        return AnomalyCategory.CONTROL

    # 2. Aerodynamic: power and rotor both low
    if power_ewma_pct < POWER_LOW_THRESHOLD and rpm_ewma_pct < RPM_LOW_THRESHOLD:
        return AnomalyCategory.AERODYNAMIC

    # 3. Mechanical: power low, rotor roughly normal
    if power_ewma_pct < POWER_LOW_THRESHOLD and rpm_mag < abs(POWER_LOW_THRESHOLD):
        return AnomalyCategory.MECHANICAL

    # 4. Electrical: rotor fast, pitch compensating
    if rpm_ewma_pct > RPM_HIGH_THRESHOLD and pitch_ewma_pct > RPM_HIGH_THRESHOLD:
        return AnomalyCategory.ELECTRICAL

    # 5. Sensor drift: power reads high, other channels normal
    if power_ewma_pct > POWER_HIGH_THRESHOLD and rpm_mag < ANOMALY_MIN_THRESHOLD:
        return AnomalyCategory.SENSOR_DRIFT

    # 6. Generic mechanical if power is low
    if power_ewma_pct < POWER_LOW_THRESHOLD:
        return AnomalyCategory.MECHANICAL

    # Default: normal (residuals elevated but no clear pattern)
    return AnomalyCategory.NORMAL


def _severity_from_magnitude(max_ewma: float) -> str:
    """Map EWMA magnitude to severity level."""
    if max_ewma > 30.0:
        return "high"
    if max_ewma > 15.0:
        return "medium"
    return "low"


def classify_anomalies(
    turbine_id: int,
    power_ewma: NDArray[np.float64],
    rpm_ewma: NDArray[np.float64],
    pitch_ewma: NDArray[np.float64],
    sample_interval: int = 6,
) -> list[AnomalyRecord]:
    """Classify anomalies for a turbine over its full time series.

    Samples every `sample_interval` timesteps to reduce output volume
    while still capturing the evolution of fault signatures.

    Args:
        turbine_id: Turbine index (0-33).
        power_ewma: EWMA of power residual [%], shape (T,).
        rpm_ewma: EWMA of rotor speed residual [%], shape (T,).
        pitch_ewma: EWMA of pitch residual [%], shape (T,).
        sample_interval: Only record every N-th timestep.

    Returns:
        List of AnomalyRecord for non-normal classifications.
    """
    records: list[AnomalyRecord] = []
    n = len(power_ewma)

    for t in range(0, n, sample_interval):
        p_ewma = float(power_ewma[t])
        r_ewma = float(rpm_ewma[t])
        pi_ewma = float(pitch_ewma[t])

        category = classify_single(p_ewma, r_ewma, pi_ewma)

        if category != AnomalyCategory.NORMAL:
            max_mag = max(abs(p_ewma), abs(r_ewma), abs(pi_ewma))
            records.append(
                AnomalyRecord(
                    turbine_id=turbine_id,
                    timestep=t,
                    category=category,
                    severity=_severity_from_magnitude(max_mag),
                    description=CATEGORY_DESCRIPTIONS[category],
                    power_ewma_pct=round(p_ewma, 2),
                    rpm_ewma_pct=round(r_ewma, 2),
                    pitch_ewma_pct=round(pi_ewma, 2),
                )
            )

    return records
