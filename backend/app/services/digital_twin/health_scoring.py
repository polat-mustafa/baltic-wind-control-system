"""Health scoring — aggregates residuals into 0-100% health index.

Physics Layer
─────────────
A turbine's health is inversely related to the magnitude of its residuals.
Small residuals → healthy; large persistent residuals → degraded.

The health index transforms continuous residual magnitudes into an
intuitive 0-100% score with categorical status levels.

Standards Layer
───────────────
- ISO 13374-1 Level 4: Health Assessment — convert detected state into
  a quantified health indicator with prognosis capability.
- ISO 13379-1: General guidelines for interpretation of condition data.

Maths Layer
───────────
Per-channel health (exponential decay from EWMA magnitude):

  H_channel = 100 × exp(-|EWMA| / σ_baseline)

where σ_baseline is the expected noise floor for healthy operation.
This maps: EWMA=0 → H=100%, EWMA=σ → H=36.8%, EWMA=3σ → H=5%.

Composite health (weighted average reflecting impact on production):

  H_total = 0.5 × H_power + 0.3 × H_rpm + 0.2 × H_pitch

Weights reflect operational importance:
- Power (0.5): direct production impact, most business-critical
- Rotor speed (0.3): drivetrain health indicator
- Pitch (0.2): control system performance

Status thresholds:
  H > 70%  → Healthy (green)
  40% ≤ H ≤ 70% → Degraded (amber) — schedule inspection
  H < 40%  → Critical (red) — immediate investigation

Code Layer
──────────
Pure functions operating on ResidualResult arrays.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np

from app.services.digital_twin.residual_analysis import ResidualResult

# ── Constants ─────────────────────────────────────────────────────

# Baseline noise floors for healthy turbine (% residual)
SIGMA_POWER = 5.0  # ±5% power noise is normal
SIGMA_RPM = 3.0  # ±3% rpm noise is normal
SIGMA_PITCH = 4.0  # ±4° pitch noise is normal

# Composite health weights
WEIGHT_POWER = 0.5
WEIGHT_RPM = 0.3
WEIGHT_PITCH = 0.2

# Status thresholds
HEALTHY_THRESHOLD = 70.0
DEGRADED_THRESHOLD = 40.0


# ── Data containers ──────────────────────────────────────────────


class HealthStatus(str, Enum):  # noqa: UP042 — StrEnum requires Python 3.11+
    """Turbine health status categories per ISO 13374-1."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"


@dataclass(frozen=True)
class TurbineHealthScore:
    """Health assessment for one turbine at one timestep or averaged."""

    health_power: float  # Power channel health [0-100%]
    health_rpm: float  # Rotor speed channel health [0-100%]
    health_pitch: float  # Pitch channel health [0-100%]
    health_composite: float  # Weighted composite health [0-100%]
    status: HealthStatus  # Categorical status


# ── Core functions ───────────────────────────────────────────────


def _channel_health(ewma_pct: float, sigma: float) -> float:
    """Compute single-channel health from EWMA residual magnitude.

    H = 100 × exp(-|EWMA| / σ)

    Maps: EWMA=0 → 100%, EWMA=σ → 36.8%, EWMA=3σ → 5%
    """
    return float(100.0 * np.exp(-abs(ewma_pct) / sigma))


def _classify_status(health_pct: float) -> HealthStatus:
    """Classify health percentage into status category."""
    if health_pct >= HEALTHY_THRESHOLD:
        return HealthStatus.HEALTHY
    if health_pct >= DEGRADED_THRESHOLD:
        return HealthStatus.DEGRADED
    return HealthStatus.CRITICAL


def compute_health_score(
    power_ewma_pct: float,
    rpm_ewma_pct: float,
    pitch_ewma_pct: float,
) -> TurbineHealthScore:
    """Compute health score from EWMA residual values.

    Args:
        power_ewma_pct: EWMA of power residual [%]
        rpm_ewma_pct: EWMA of rotor speed residual [%]
        pitch_ewma_pct: EWMA of pitch residual [%]

    Returns:
        TurbineHealthScore with per-channel and composite scores.
    """
    h_power = _channel_health(power_ewma_pct, SIGMA_POWER)
    h_rpm = _channel_health(rpm_ewma_pct, SIGMA_RPM)
    h_pitch = _channel_health(pitch_ewma_pct, SIGMA_PITCH)

    h_composite = WEIGHT_POWER * h_power + WEIGHT_RPM * h_rpm + WEIGHT_PITCH * h_pitch
    status = _classify_status(h_composite)

    return TurbineHealthScore(
        health_power=round(h_power, 2),
        health_rpm=round(h_rpm, 2),
        health_pitch=round(h_pitch, 2),
        health_composite=round(h_composite, 2),
        status=status,
    )


def compute_health_timeseries(
    residuals: ResidualResult,
) -> list[TurbineHealthScore]:
    """Compute health score at each timestep for one turbine.

    Returns a list of TurbineHealthScore, one per timestep. Uses the
    EWMA-smoothed residuals for stable health assessment.
    """
    n = len(residuals.power_ewma)
    scores: list[TurbineHealthScore] = []

    for i in range(n):
        score = compute_health_score(
            float(residuals.power_ewma[i]),
            float(residuals.rpm_ewma[i]),
            float(residuals.pitch_ewma[i]),
        )
        scores.append(score)

    return scores


def compute_farm_health(
    turbine_scores: list[TurbineHealthScore],
) -> dict[str, int | float]:
    """Aggregate individual turbine scores into farm-level summary.

    Returns:
        dict with farm_health_pct, healthy_count, degraded_count, critical_count
    """
    if not turbine_scores:
        return {
            "farm_health_pct": 0.0,
            "healthy_count": 0,
            "degraded_count": 0,
            "critical_count": 0,
        }

    composites = [s.health_composite for s in turbine_scores]
    statuses = [s.status for s in turbine_scores]

    return {
        "farm_health_pct": round(float(np.mean(composites)), 2),
        "healthy_count": sum(1 for s in statuses if s == HealthStatus.HEALTHY),
        "degraded_count": sum(1 for s in statuses if s == HealthStatus.DEGRADED),
        "critical_count": sum(1 for s in statuses if s == HealthStatus.CRITICAL),
    }
