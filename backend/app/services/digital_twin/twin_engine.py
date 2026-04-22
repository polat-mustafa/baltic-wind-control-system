"""Twin engine — analytical V236 reference model for healthy-behavior predictions.

Physics Layer
─────────────
A digital twin predicts what a turbine SHOULD produce given current wind
conditions. For condition monitoring, the twin must be the same reference
model used to generate the healthy baseline — otherwise "residuals" would
just be model mismatch, not real turbine degradation.

We use the IEC 61400-12-1 analytical power curve from ``turbine_power_curve``
— identical to the one driving ``scada_generator.generate_scada_dataset``.
Rotor speed and pitch are derived from the V236 operating envelope:

  • Below cut-in or above cut-out  → power = 0, rpm = 0, pitch = 0
  • Region 2 (cut-in ≤ v < rated)  → TSR-following: rpm scales with wind,
                                     pitch held at 0° (fine pitch / Cp-optimal)
  • Region 3 (v ≥ rated)           → rpm clamped to rated, pitch increases
                                     to shed aerodynamic power (pitch control)

Standards Layer
───────────────
- ISO 13374-1 Level 2: Data Manipulation — the twin provides the "expected"
  reference signal that residual analysis compares against actual SCADA data.
- IEC 61400-12-1: Power performance measurement — defines the reference curve.
- IEC 61400-25-2: The twin output maps to the same SCADA data model.

Maths Layer
───────────
Lookup table on a wind-speed × wind-direction grid, interpolated bilinearly.
The curve is direction-independent (analytical power curve does not depend on
wind direction), so the direction axis collapses — but the grid API is kept
unchanged so callers don't need to know. This also leaves a hook for future
direction-dependent corrections (e.g., wake-induced derating).

Code Layer
──────────
Zero duplication with the SCADA generator: both call the same
``interpolate_power_mw`` on the same ``build_power_curve()`` result, so in the
healthy scenario the twin and actual power match exactly (modulo ±2 %
measurement noise the generator adds).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p4.turbine_power_curve import (
    build_power_curve,
    get_v236_spec,
    interpolate_power_mw,
)

# ── Constants ─────────────────────────────────────────────────────

WIND_SPEED_MIN = 0.0
WIND_SPEED_MAX = 35.0
WIND_SPEED_STEP = 0.5
WIND_DIR_MIN = 0.0
WIND_DIR_MAX = 350.0
WIND_DIR_STEP = 10.0

# V236-15.0 MW rated rotor speed (matches drivetrain.py and state_machine.py)
RATED_ROTOR_SPEED_RPM: float = 8.33

# Pitch authority in region 3: deg per (m/s) above rated, clamped to PITCH_MAX_DEG.
# Calibrated so pitch runs from 0° at rated speed to ~30° near cut-out — consistent
# with V236 pitch behaviour reported by the turbine_physics controller.
PITCH_SLOPE_DEG_PER_MS: float = 1.5
PITCH_MAX_DEG: float = 30.0


# ── Data containers ──────────────────────────────────────────────


@dataclass(frozen=True)
class TwinPrediction:
    """Steady-state twin prediction at one operating point."""

    wind_speed_ms: float
    wind_dir_deg: float
    power_mw: float  # Expected electrical power [MW]
    rotor_speed_rpm: float  # Expected rotor speed [rpm]
    pitch_angle_deg: float  # Expected pitch angle [deg]


@dataclass
class TwinLookupTable:
    """Pre-computed twin predictions on a (speed × dir) grid.

    Attributes
    ----------
    wind_speeds : 1-D array of wind speed grid points [m/s]
    wind_dirs : 1-D array of wind direction grid points [deg]
    power_grid : 2-D array [n_speeds × n_dirs] of power predictions [MW]
    rpm_grid : 2-D array [n_speeds × n_dirs] of rotor speed predictions [rpm]
    pitch_grid : 2-D array [n_speeds × n_dirs] of pitch angle predictions [deg]
    """

    wind_speeds: NDArray[np.float64]
    wind_dirs: NDArray[np.float64]
    power_grid: NDArray[np.float64]
    rpm_grid: NDArray[np.float64]
    pitch_grid: NDArray[np.float64]


# ── Module-level cache ───────────────────────────────────────────

_cached_table: TwinLookupTable | None = None


# ── Core functions ───────────────────────────────────────────────


def _expected_rpm(wind_speed_ms: float) -> float:
    """Analytical V236 rotor-speed reference.

    Region 1/4 → 0. Region 2 → linear ramp to rated. Region 3 → rated.
    """
    spec = get_v236_spec()
    if wind_speed_ms < spec.cut_in_speed_ms or wind_speed_ms > spec.cut_out_speed_ms:
        return 0.0
    if wind_speed_ms < spec.rated_speed_ms:
        frac = (wind_speed_ms - spec.cut_in_speed_ms) / (
            spec.rated_speed_ms - spec.cut_in_speed_ms
        )
        return RATED_ROTOR_SPEED_RPM * frac
    return RATED_ROTOR_SPEED_RPM


def _expected_pitch(wind_speed_ms: float) -> float:
    """Analytical V236 pitch reference.

    Region 1/4 → 0 (feathered at shutdown is handled by state machine, not here).
    Region 2 → 0° fine pitch (Cp-optimal).
    Region 3 → linear increase with excess wind, capped at PITCH_MAX_DEG.
    """
    spec = get_v236_spec()
    if wind_speed_ms < spec.cut_in_speed_ms or wind_speed_ms > spec.cut_out_speed_ms:
        return 0.0
    if wind_speed_ms < spec.rated_speed_ms:
        return 0.0
    excess = wind_speed_ms - spec.rated_speed_ms
    return min(PITCH_MAX_DEG, PITCH_SLOPE_DEG_PER_MS * excess)


def run_twin_at_operating_point(
    wind_speed_ms: float,
    wind_dir_deg: float = 0.0,
) -> TwinPrediction:
    """Evaluate the analytical twin at one operating point.

    Pure function — no simulator state. Used primarily by tests; normal
    dashboard flow goes through the cached lookup table.
    """
    curve = build_power_curve()
    power = float(interpolate_power_mw(wind_speed_ms, curve))
    return TwinPrediction(
        wind_speed_ms=wind_speed_ms,
        wind_dir_deg=wind_dir_deg,
        power_mw=max(0.0, power),
        rotor_speed_rpm=_expected_rpm(wind_speed_ms),
        pitch_angle_deg=_expected_pitch(wind_speed_ms),
    )


def build_twin_lookup_table() -> TwinLookupTable:
    """Pre-compute twin predictions for a grid of (speed × direction).

    The analytical curve is direction-independent, so every direction column
    holds the same values — the grid shape is preserved purely for API
    stability and future extensibility (e.g., wake-induced derating).

    Returns cached table if already computed.
    """
    global _cached_table
    if _cached_table is not None:
        return _cached_table

    wind_speeds: NDArray[np.float64] = np.arange(
        WIND_SPEED_MIN, WIND_SPEED_MAX + WIND_SPEED_STEP, WIND_SPEED_STEP, dtype=np.float64
    )
    wind_dirs: NDArray[np.float64] = np.arange(
        WIND_DIR_MIN, WIND_DIR_MAX + WIND_DIR_STEP, WIND_DIR_STEP, dtype=np.float64
    )

    n_speeds = len(wind_speeds)
    n_dirs = len(wind_dirs)

    curve = build_power_curve()

    # Evaluate the analytical curve once per speed, broadcast across directions.
    power_col: NDArray[np.float64] = np.maximum(
        np.asarray(interpolate_power_mw(wind_speeds, curve), dtype=np.float64), 0.0
    )
    rpm_col: NDArray[np.float64] = np.asarray(
        [_expected_rpm(float(v)) for v in wind_speeds], dtype=np.float64
    )
    pitch_col: NDArray[np.float64] = np.asarray(
        [_expected_pitch(float(v)) for v in wind_speeds], dtype=np.float64
    )

    power_grid = np.broadcast_to(power_col[:, None], (n_speeds, n_dirs)).copy()
    rpm_grid = np.broadcast_to(rpm_col[:, None], (n_speeds, n_dirs)).copy()
    pitch_grid = np.broadcast_to(pitch_col[:, None], (n_speeds, n_dirs)).copy()

    _cached_table = TwinLookupTable(
        wind_speeds=wind_speeds,
        wind_dirs=wind_dirs,
        power_grid=power_grid,
        rpm_grid=rpm_grid,
        pitch_grid=pitch_grid,
    )
    return _cached_table


def _bilinear_interpolate(
    grid: NDArray[np.float64],
    x_arr: NDArray[np.float64],
    y_arr: NDArray[np.float64],
    x_val: float,
    y_val: float,
) -> float:
    """Bilinear interpolation on a 2-D grid.

    Finds the four surrounding grid points and interpolates between them.
    Clamps to grid boundaries for out-of-range values.
    """
    # Clamp to grid bounds
    x_val = float(np.clip(x_val, x_arr[0], x_arr[-1]))
    y_val = float(np.clip(y_val, y_arr[0], y_arr[-1]))

    # Find surrounding indices
    ix: int = int(np.searchsorted(x_arr, x_val, side="right")) - 1
    iy: int = int(np.searchsorted(y_arr, y_val, side="right")) - 1

    ix = int(np.clip(ix, 0, len(x_arr) - 2))
    iy = int(np.clip(iy, 0, len(y_arr) - 2))

    # Fractional position within cell
    x0, x1 = x_arr[ix], x_arr[ix + 1]
    y0, y1 = y_arr[iy], y_arr[iy + 1]

    dx = (x_val - x0) / (x1 - x0) if x1 != x0 else 0.0
    dy = (y_val - y0) / (y1 - y0) if y1 != y0 else 0.0

    # Bilinear interpolation
    val = (
        grid[ix, iy] * (1 - dx) * (1 - dy)
        + grid[ix + 1, iy] * dx * (1 - dy)
        + grid[ix, iy + 1] * (1 - dx) * dy
        + grid[ix + 1, iy + 1] * dx * dy
    )

    return float(val)


def lookup_twin_prediction(
    table: TwinLookupTable,
    wind_speed_ms: float,
    wind_dir_deg: float = 0.0,
) -> TwinPrediction:
    """Look up twin prediction using bilinear interpolation on cached table.

    Sub-millisecond performance; the table is built once per process.
    """
    power = _bilinear_interpolate(
        table.power_grid,
        table.wind_speeds,
        table.wind_dirs,
        wind_speed_ms,
        wind_dir_deg,
    )
    rpm = _bilinear_interpolate(
        table.rpm_grid,
        table.wind_speeds,
        table.wind_dirs,
        wind_speed_ms,
        wind_dir_deg,
    )
    pitch = _bilinear_interpolate(
        table.pitch_grid,
        table.wind_speeds,
        table.wind_dirs,
        wind_speed_ms,
        wind_dir_deg,
    )

    return TwinPrediction(
        wind_speed_ms=wind_speed_ms,
        wind_dir_deg=wind_dir_deg,
        power_mw=max(0.0, power),
        rotor_speed_rpm=max(0.0, rpm),
        pitch_angle_deg=max(0.0, pitch),
    )


def clear_twin_cache() -> None:
    """Clear the cached lookup table (useful for testing)."""
    global _cached_table
    _cached_table = None
