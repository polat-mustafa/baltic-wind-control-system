"""Twin engine — wraps existing physics simulator for steady-state predictions.

Physics Layer
─────────────
A digital twin predicts what a turbine SHOULD produce given current wind
conditions. The prediction comes from the same physics model used in the
turbine simulator (aerodynamics + pitch + drivetrain + rotor dynamics).

For steady-state prediction, we run the simulator for ~100 steps at constant
wind speed to let the controller settle, then take the final state as the
twin's prediction for that operating point.

Standards Layer
───────────────
- ISO 13374-1 Level 2: Data Manipulation — the twin provides the "expected"
  reference signal that residual analysis compares against actual SCADA data.
- IEC 61400-25-2: The twin output maps to the same SCADA data model.

Maths Layer
───────────
Lookup table approach for performance:
- Pre-compute predictions for wind_speed × wind_dir grid
- wind_speed: [0, 0.5, 1.0, ..., 35.0] → 71 values
- wind_dir: [0, 10, 20, ..., 350°] → 36 values
- Total: 71 × 36 = 2,556 steady-state simulations
- Each simulation: 100 steps × 0.1s dt = 10s of simulated time
- Runtime: 2,556 sims vs 3.4M steps for direct computation

For arbitrary (speed, dir) pairs, use bilinear interpolation on the lookup
table. This gives sub-millisecond lookups vs ~10ms per direct simulation.

Code Layer
──────────
Reuses run_simulation() from turbine_physics/simulator.py — zero physics
duplication. The twin IS the simulator, just pre-computed at steady state.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.turbine_physics.simulator import SimulationConfig, run_simulation

# ── Constants ─────────────────────────────────────────────────────

STEADY_STATE_STEPS = 100  # Steps to reach steady state (~10s at dt=0.1)
WIND_SPEED_MIN = 0.0
WIND_SPEED_MAX = 35.0
WIND_SPEED_STEP = 0.5
WIND_DIR_MIN = 0.0
WIND_DIR_MAX = 350.0
WIND_DIR_STEP = 10.0


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


def run_twin_at_operating_point(
    wind_speed_ms: float,
    wind_dir_deg: float = 0.0,
    num_steps: int = STEADY_STATE_STEPS,
) -> TwinPrediction:
    """Run simulator at constant wind to get steady-state prediction.

    Runs the physics simulator for `num_steps` at constant conditions,
    takes the final state as the twin's prediction. This is the "truth"
    model — what a healthy turbine should produce.
    """
    wind_speeds = [wind_speed_ms] * num_steps
    wind_dirs = [wind_dir_deg] * num_steps
    config = SimulationConfig(dt=0.1)

    result = run_simulation(wind_speeds, wind_dirs, config)

    return TwinPrediction(
        wind_speed_ms=wind_speed_ms,
        wind_dir_deg=wind_dir_deg,
        power_mw=float(result.electrical_power_mw[-1]),
        rotor_speed_rpm=float(result.rotor_speed_rpm[-1]),
        pitch_angle_deg=float(result.pitch_angle_deg[-1]),
    )


def build_twin_lookup_table() -> TwinLookupTable:
    """Pre-compute twin predictions for a grid of (speed × direction).

    Creates a lookup table that can be interpolated for any operating point.
    This is the key performance optimization — pre-compute 2,556 simulations
    once, then use fast bilinear interpolation for millions of lookups.

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

    power_grid = np.zeros((n_speeds, n_dirs), dtype=np.float64)
    rpm_grid = np.zeros((n_speeds, n_dirs), dtype=np.float64)
    pitch_grid = np.zeros((n_speeds, n_dirs), dtype=np.float64)

    config = SimulationConfig(dt=0.1)

    for i, ws in enumerate(wind_speeds):
        for j, wd in enumerate(wind_dirs):
            wind_arr = [float(ws)] * STEADY_STATE_STEPS
            dir_arr = [float(wd)] * STEADY_STATE_STEPS

            result = run_simulation(wind_arr, dir_arr, config)

            power_grid[i, j] = float(result.electrical_power_mw[-1])
            rpm_grid[i, j] = float(result.rotor_speed_rpm[-1])
            pitch_grid[i, j] = float(result.pitch_angle_deg[-1])

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
    x_val = np.clip(x_val, x_arr[0], x_arr[-1])
    y_val = np.clip(y_val, y_arr[0], y_arr[-1])

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

    Sub-millisecond performance vs ~10ms for a full simulation.
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
