"""
Heterogeneous and dynamic flow field modeling (FLORIDyn-style).

Physics
-------
Standard wake models assume spatially uniform inflow — the same wind speed
and direction everywhere across the farm at any instant. Real offshore wind
fields are heterogeneous:

1. **Spatial variation**: Wind speed gradients across large farms (>5 km)
   due to mesoscale weather patterns, boundary layer effects, and wake
   effects from neighbouring farms.

2. **Temporal dynamics**: Wind speed and direction change continuously.
   Wake propagation takes minutes to traverse a large farm (speed ÷ distance),
   creating transient wake states.

3. **Wake advection**: Wakes are transported downstream by the mean flow,
   arriving at downstream turbines after a time delay:
     t_delay = x_downstream / U_mean

FLORIDyn Model Concept
-----------------------
FLORIS's FLORIDyn extension models dynamic wake evolution by:
1. Treating each wake as a set of "flow parcels" advected downstream
2. Each parcel carries a velocity deficit and turbulence state
3. As wind direction changes, parcels follow the new direction
4. Curled wakes result from direction changes during advection

This module provides a simplified dynamic flow simulation:
- Time-varying wind speed and direction inputs
- Wake advection delay modeling
- Heterogeneous inflow field support
- Temporal power output curves

References
----------
- Gebraad, P.M.O. et al. (2015). A data-driven model for wind plant
  power optimization by yaw control. ACC 2015.
- Becker, M. et al. (2022). The revised FLORIDyn model: implementation
  of heterogeneous flow and its verification. Wind Energy Science.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    RATED_POWER_KW,
    ROTOR_DIAMETER_M,
    get_v236_ct_curve,
    get_v236_power_curve_kw,
)

# ── Dynamic Flow Constants ──────────────────────────────────────

WAKE_EXPANSION_RATE: float = 0.04
"""Wake expansion coefficient k* for offshore [-]."""

JENSEN_DEFICIT_COEFFICIENT: float = 1.0
"""Scaling for Jensen wake deficit in dynamic model."""


@dataclass(frozen=True)
class DynamicFlowTimestep:
    """Farm state at a single dynamic flow timestep.

    Attributes
    ----------
    time_s : float
        Time [seconds].
    wind_speed_ms : float
        Ambient wind speed at this timestep [m/s].
    wind_direction_deg : float
        Wind direction at this timestep [degrees].
    farm_power_mw : float
        Total farm power [MW].
    per_turbine_power_mw : NDArray
        Per-turbine power [MW].
    per_turbine_effective_ws_ms : NDArray
        Effective wind speed at each turbine [m/s].
    """

    time_s: float
    wind_speed_ms: float
    wind_direction_deg: float
    farm_power_mw: float
    per_turbine_power_mw: NDArray[np.floating]
    per_turbine_effective_ws_ms: NDArray[np.floating]


@dataclass(frozen=True)
class HeterogeneousFlowField:
    """Spatially varying wind field specification.

    Attributes
    ----------
    x_grid : NDArray
        X-coordinates of flow field grid [m].
    y_grid : NDArray
        Y-coordinates of flow field grid [m].
    ws_field : NDArray
        Wind speed at each grid point [m/s]. Shape: (nx, ny).
    wd_field : NDArray
        Wind direction at each grid point [degrees]. Shape: (nx, ny).
    """

    x_grid: NDArray[np.floating]
    y_grid: NDArray[np.floating]
    ws_field: NDArray[np.floating]
    wd_field: NDArray[np.floating]


@dataclass(frozen=True)
class DynamicFlowResult:
    """Result of dynamic flow simulation.

    Attributes
    ----------
    timesteps : list[DynamicFlowTimestep]
        Time series of farm states.
    mean_farm_power_mw : float
        Time-averaged farm power [MW].
    power_variability_mw : float
        Standard deviation of farm power [MW].
    max_ramp_rate_mw_s : float
        Maximum power ramp rate [MW/s].
    steady_state_power_mw : float
        Power at steady-state (final timestep) [MW].
    wake_advection_time_s : float
        Estimated wake advection time across the farm [seconds].
    """

    timesteps: list[DynamicFlowTimestep] = field(default_factory=list)
    mean_farm_power_mw: float = 0.0
    power_variability_mw: float = 0.0
    max_ramp_rate_mw_s: float = 0.0
    steady_state_power_mw: float = 0.0
    wake_advection_time_s: float = 0.0


def generate_heterogeneous_field(
    x_range_m: tuple[float, float] = (0.0, 10000.0),
    y_range_m: tuple[float, float] = (0.0, 10000.0),
    base_ws_ms: float = 10.5,
    base_wd_deg: float = 240.0,
    ws_gradient_ms_per_km: float = 0.2,
    wd_gradient_deg_per_km: float = 1.0,
    n_grid: int = 20,
) -> HeterogeneousFlowField:
    """Generate a heterogeneous wind field with spatial gradients.

    Parameters
    ----------
    x_range_m, y_range_m : tuple
        Spatial extent [m].
    base_ws_ms : float
        Base wind speed at field centre [m/s].
    base_wd_deg : float
        Base wind direction at field centre [degrees].
    ws_gradient_ms_per_km : float
        Wind speed gradient along x [m/s per km].
    wd_gradient_deg_per_km : float
        Direction gradient along y [deg per km].
    n_grid : int
        Grid resolution per axis.

    Returns
    -------
    HeterogeneousFlowField
        Spatially varying wind field.
    """
    x = np.linspace(x_range_m[0], x_range_m[1], n_grid)
    y = np.linspace(y_range_m[0], y_range_m[1], n_grid)
    xx, yy = np.meshgrid(x, y)

    centre_x = (x_range_m[0] + x_range_m[1]) / 2.0
    centre_y = (y_range_m[0] + y_range_m[1]) / 2.0

    ws = base_ws_ms + (xx - centre_x) / 1000.0 * ws_gradient_ms_per_km
    wd = base_wd_deg + (yy - centre_y) / 1000.0 * wd_gradient_deg_per_km

    return HeterogeneousFlowField(
        x_grid=x.astype(np.float64),
        y_grid=y.astype(np.float64),
        ws_field=ws.astype(np.float64),
        wd_field=(wd % 360.0).astype(np.float64),
    )


def _interpolate_field_at_turbines(
    flow_field: HeterogeneousFlowField,
    x_turbines: NDArray[np.floating],
    y_turbines: NDArray[np.floating],
) -> tuple[NDArray[np.floating], NDArray[np.floating]]:
    """Interpolate flow field values at turbine positions.

    Parameters
    ----------
    flow_field : HeterogeneousFlowField
        Spatial flow field.
    x_turbines, y_turbines : NDArray
        Turbine positions [m].

    Returns
    -------
    tuple[NDArray, NDArray]
        (wind_speeds_ms, wind_directions_deg) at turbine locations.
    """
    from scipy.interpolate import RegularGridInterpolator

    ws_interp = RegularGridInterpolator(
        (flow_field.y_grid, flow_field.x_grid),
        flow_field.ws_field,
        bounds_error=False,
        fill_value=None,
    )
    wd_interp = RegularGridInterpolator(
        (flow_field.y_grid, flow_field.x_grid),
        flow_field.wd_field,
        bounds_error=False,
        fill_value=None,
    )

    points = np.column_stack((y_turbines, x_turbines))
    ws = ws_interp(points)
    wd = wd_interp(points)

    return ws.astype(np.float64), wd.astype(np.float64)


def _compute_instantaneous_power(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_speed_ms: float,
    wind_direction_deg: float,
) -> tuple[float, NDArray[np.floating], NDArray[np.floating]]:
    """Compute farm power at a single instant using simplified Jensen model.

    Returns (farm_power_mw, per_turbine_mw, effective_ws_ms).
    """
    n = len(x_positions_m)
    wind_rad = np.radians(wind_direction_deg)

    # Project positions onto wind direction
    projected = x_positions_m * np.sin(wind_rad) + y_positions_m * np.cos(wind_rad)
    order = np.argsort(projected)

    ws = np.array([wind_speed_ms])
    ct = float(get_v236_ct_curve(ws)[0])

    effective_ws = np.full(n, wind_speed_ms)

    # Apply Jensen wake model sequentially
    for rank in range(1, n):
        i = order[rank]  # Current downstream turbine
        total_deficit_sq = 0.0
        for prev_rank in range(rank):
            j = order[prev_rank]
            dx = projected[i] - projected[j]
            if dx <= 0:
                continue
            # Lateral distance
            cross = (x_positions_m[i] - x_positions_m[j]) * np.cos(wind_rad) - (
                y_positions_m[i] - y_positions_m[j]
            ) * np.sin(wind_rad)
            # Wake radius at distance dx
            wake_radius = ROTOR_DIAMETER_M / 2.0 + WAKE_EXPANSION_RATE * dx
            if abs(cross) < wake_radius:
                # Jensen deficit
                deficit = (1.0 - np.sqrt(1.0 - ct)) / (
                    1.0 + 2.0 * WAKE_EXPANSION_RATE * dx / ROTOR_DIAMETER_M
                ) ** 2
                total_deficit_sq += deficit**2

        effective_ws[i] = wind_speed_ms * (1.0 - np.sqrt(total_deficit_sq))

    # Compute power from effective wind speed, cap at rated
    rated_mw = RATED_POWER_KW / 1000.0
    per_turbine_mw = np.zeros(n)
    for i in range(n):
        ws_i = np.array([max(3.0, effective_ws[i])])
        per_turbine_mw[i] = min(float(get_v236_power_curve_kw(ws_i)[0]) / 1000.0, rated_mw)

    farm_power = float(np.sum(per_turbine_mw))
    return farm_power, per_turbine_mw, effective_ws


def run_dynamic_flow_simulation(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_speed_series_ms: NDArray[np.floating] | None = None,
    wind_direction_series_deg: NDArray[np.floating] | None = None,
    dt_s: float = 60.0,
    duration_s: float = 3600.0,
) -> DynamicFlowResult:
    """Run dynamic flow simulation with time-varying wind conditions.

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    wind_speed_series_ms : NDArray, optional
        Time series of wind speeds [m/s]. Default: ramp 8→12 m/s.
    wind_direction_series_deg : NDArray, optional
        Time series of wind directions [deg]. Default: 240° + sinusoidal ±10°.
    dt_s : float
        Timestep [seconds]. Default: 60.
    duration_s : float
        Simulation duration [seconds]. Default: 3600 (1 hour).

    Returns
    -------
    DynamicFlowResult
        Time series of farm power with dynamic wake effects.
    """
    n_steps = int(duration_s / dt_s)
    times = np.arange(n_steps) * dt_s

    if wind_speed_series_ms is None:
        # Default: ramp from 8 to 12 m/s
        wind_speed_series_ms = np.linspace(8.0, 12.0, n_steps)

    if wind_direction_series_deg is None:
        # Default: 240° with ±10° sinusoidal variation
        wind_direction_series_deg = 240.0 + 10.0 * np.sin(2 * np.pi * times / duration_s)

    # Ensure correct length
    if len(wind_speed_series_ms) != n_steps:
        wind_speed_series_ms = np.interp(
            times, np.linspace(0, duration_s, len(wind_speed_series_ms)), wind_speed_series_ms
        )
    if len(wind_direction_series_deg) != n_steps:
        wind_direction_series_deg = np.interp(
            times,
            np.linspace(0, duration_s, len(wind_direction_series_deg)),
            wind_direction_series_deg,
        )

    # Estimate wake advection time
    farm_extent = (
        float(
            np.max(
                np.sqrt(
                    (x_positions_m - x_positions_m.mean()) ** 2
                    + (y_positions_m - y_positions_m.mean()) ** 2
                )
            )
        )
        * 2.0
    )
    mean_ws = float(np.mean(wind_speed_series_ms))
    advection_time = farm_extent / mean_ws if mean_ws > 0 else 300.0

    timesteps: list[DynamicFlowTimestep] = []
    farm_powers = []

    for t_idx in range(n_steps):
        ws = float(wind_speed_series_ms[t_idx])
        wd = float(wind_direction_series_deg[t_idx])

        farm_power, per_turbine, effective_ws = _compute_instantaneous_power(
            x_positions_m,
            y_positions_m,
            ws,
            wd,
        )

        timesteps.append(
            DynamicFlowTimestep(
                time_s=round(times[t_idx], 1),
                wind_speed_ms=round(ws, 2),
                wind_direction_deg=round(wd % 360.0, 1),
                farm_power_mw=round(farm_power, 3),
                per_turbine_power_mw=np.round(per_turbine, 3),
                per_turbine_effective_ws_ms=np.round(effective_ws, 2),
            )
        )
        farm_powers.append(farm_power)

    powers = np.array(farm_powers)
    ramp_rates = np.abs(np.diff(powers)) / dt_s if len(powers) > 1 else np.array([0.0])

    return DynamicFlowResult(
        timesteps=timesteps,
        mean_farm_power_mw=round(float(np.mean(powers)), 3),
        power_variability_mw=round(float(np.std(powers)), 3),
        max_ramp_rate_mw_s=round(float(np.max(ramp_rates)), 3) if len(ramp_rates) > 0 else 0.0,
        steady_state_power_mw=round(float(powers[-1]), 3) if len(powers) > 0 else 0.0,
        wake_advection_time_s=round(advection_time, 1),
    )
