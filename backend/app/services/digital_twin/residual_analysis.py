"""Residual analysis — computes deviation between twin prediction and SCADA.

Physics Layer
─────────────
The residual is the difference between what the turbine ACTUALLY produces
(SCADA measurement) and what it SHOULD produce (twin prediction). A healthy
turbine has near-zero residuals; a degraded turbine shows persistent bias.

  residual = actual - predicted

Positive residual → turbine produces MORE than expected (rare — sensor drift)
Negative residual → turbine produces LESS than expected (degradation, faults)

Standards Layer
───────────────
- ISO 13374-1 Level 3: State Detection — residual magnitude triggers alerts
- IEC 61400-25-6: Condition monitoring logical nodes (XCBR, CSWI)

Maths Layer
───────────
Multi-channel residuals with EWMA smoothing:

1. Raw residual: r(t) = actual(t) - twin(t)
2. Normalized: r_pct(t) = r(t) / twin(t) × 100  [%]
3. EWMA smoothing: ema(t) = α × r(t) + (1-α) × ema(t-1)
   where α = 2/(span+1), span=24 (4 hours of 10-min data)

The EWMA filters out measurement noise while preserving persistent trends.
A jump in EWMA magnitude indicates a real change in turbine condition.

Code Layer
──────────
Operates on numpy arrays for vectorized computation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# ── Constants ─────────────────────────────────────────────────────

EWMA_SPAN = 24  # 24 × 10-min intervals = 4 hours
EWMA_ALPHA = 2.0 / (EWMA_SPAN + 1)  # ≈ 0.08


# ── Data containers ──────────────────────────────────────────────


@dataclass(frozen=True)
class ResidualResult:
    """Multi-channel residual analysis for one turbine.

    All arrays have shape (num_timesteps,).
    """

    # Raw residuals
    power_residual_mw: NDArray[np.float64]
    rpm_residual: NDArray[np.float64]
    pitch_residual_deg: NDArray[np.float64]

    # Normalized residuals (percentage)
    power_residual_pct: NDArray[np.float64]
    rpm_residual_pct: NDArray[np.float64]
    pitch_residual_pct: NDArray[np.float64]

    # EWMA-smoothed residuals
    power_ewma: NDArray[np.float64]
    rpm_ewma: NDArray[np.float64]
    pitch_ewma: NDArray[np.float64]


# ── Core functions ───────────────────────────────────────────────


def _compute_ewma(values: NDArray[np.float64], alpha: float = EWMA_ALPHA) -> NDArray[np.float64]:
    """Compute Exponentially Weighted Moving Average.

    EWMA(t) = α × x(t) + (1-α) × EWMA(t-1)

    This is a simple first-order IIR filter. The span parameter controls
    the effective window: span=24 means ~24 samples contribute significantly.
    """
    n = len(values)
    ewma = np.zeros(n, dtype=np.float64)
    # Zero cold-start: a low-wind spike at t=0 must not poison the ~24-sample
    # memory window. The filter warms up over its span instead.
    ewma[0] = 0.0

    for i in range(1, n):
        ewma[i] = alpha * values[i] + (1.0 - alpha) * ewma[i - 1]

    return ewma


def _normalize_residual(
    residual: NDArray[np.float64],
    reference: NDArray[np.float64],
    min_ref: float = 0.1,
) -> NDArray[np.float64]:
    """Normalize residual as percentage of reference.

    r_pct = (actual - twin) / max(|twin|, min_ref) × 100

    The min_ref floor prevents division by zero when the twin prediction
    is near zero (e.g., below cut-in wind speed).
    """
    safe_ref = np.maximum(np.abs(reference), min_ref)
    return np.asarray((residual / safe_ref) * 100.0, dtype=np.float64)


def compute_residuals(
    actual_power_mw: NDArray[np.float64],
    actual_rpm: NDArray[np.float64],
    actual_pitch_deg: NDArray[np.float64],
    twin_power_mw: NDArray[np.float64],
    twin_rpm: NDArray[np.float64],
    twin_pitch_deg: NDArray[np.float64],
    ewma_alpha: float = EWMA_ALPHA,
) -> ResidualResult:
    """Compute multi-channel residuals between actual and twin data.

    Args:
        actual_*: SCADA measurements for power, rotor speed, pitch angle.
        twin_*: Digital twin predictions for the same channels.
        ewma_alpha: EWMA smoothing factor (default: 2/(24+1) ≈ 0.08).

    Returns:
        ResidualResult with raw, normalized, and EWMA-smoothed residuals.
    """
    # Raw residuals
    power_res = actual_power_mw - twin_power_mw
    rpm_res = actual_rpm - twin_rpm
    pitch_res = actual_pitch_deg - twin_pitch_deg

    # Normalized (percentage). Floors prevent low-output periods from blowing
    # tiny absolute residuals into huge percentages:
    #   - power: 1.0 MW (~7% of rated) — below this the turbine isn't
    #     producing meaningfully and health cannot be assessed.
    #   - rpm:   0.1 rpm — rated is 8.33 rpm, so 0.1 is a safe non-zero floor.
    #   - pitch: 1.0° — baseline 0° pitch noise must not emit phantom residuals.
    power_pct = _normalize_residual(power_res, twin_power_mw, min_ref=1.0)
    rpm_pct = _normalize_residual(rpm_res, twin_rpm, min_ref=0.1)
    pitch_pct = _normalize_residual(pitch_res, twin_pitch_deg, min_ref=1.0)

    # EWMA smoothing
    power_ewma = _compute_ewma(power_pct, ewma_alpha)
    rpm_ewma = _compute_ewma(rpm_pct, ewma_alpha)
    pitch_ewma = _compute_ewma(pitch_pct, ewma_alpha)

    return ResidualResult(
        power_residual_mw=power_res,
        rpm_residual=rpm_res,
        pitch_residual_deg=pitch_res,
        power_residual_pct=power_pct,
        rpm_residual_pct=rpm_pct,
        pitch_residual_pct=pitch_pct,
        power_ewma=power_ewma,
        rpm_ewma=rpm_ewma,
        pitch_ewma=pitch_ewma,
    )
