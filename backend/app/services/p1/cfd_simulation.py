"""
CFD-based wind simulation (RANS, actuator disk/line, terrain, mesh).

Covers gaps B1–B4 from the reference project analysis. Full RANS CFD
(like WindSE) requires FEniCS and is computationally prohibitive for a
web platform. This module provides an educational analytical approximation
of the CFD concepts: RANS-like velocity fields, actuator disk/line
turbine representations, terrain effects, and mesh generation.

Physics — RANS Equations (B1)
------------------------------
Reynolds-Averaged Navier-Stokes decompose flow into mean + fluctuating:
    ū_i = U_i + u'_i

The mean momentum equation:
    ∂U_i/∂t + U_j ∂U_i/∂x_j = -1/ρ ∂P/∂x_i + ν ∂²U_i/∂x_j² - ∂(u'_i u'_j)/∂x_j

The Reynolds stress tensor -ρ(u'_i u'_j) requires a turbulence closure model.
k-ε model: νt = Cμ k²/ε (eddy viscosity from TKE k and dissipation ε).

Physics — Actuator Disk / Line (B2)
-------------------------------------
Actuator disk: turbine = uniform momentum sink across rotor disk area.
    F_disk = 0.5 × ρ × A_rotor × U² × Ct

Actuator line: each blade = distributed line force along blade span.
More accurate but requires resolving blade rotation.

Physics — Terrain (B3)
------------------------
Terrain modifies the flow field through:
- Speed-up over hills (Bernoulli)
- Flow separation behind ridges
- Directional changes from channeling
For offshore Baltic Sea: effectively flat (terrain effect negligible).

Physics — Mesh Generation (B4)
-------------------------------
CFD mesh quality determines accuracy. Key metrics:
- Element size: smaller = more accurate but more expensive
- Aspect ratio: should be < 5:1 for accuracy
- Skewness: < 0.9 for stability
Adaptive refinement focuses resolution near turbines and wakes.

References
----------
- Pope, S.B. (2000). Turbulent Flows. Cambridge University Press.
- Sørensen, J.N. & Shen, W.Z. (2002). J. Fluids Eng., 124(2), 393-399.
- WindSE: github.com/NREL/WindSE — FEniCS-based wind farm simulator
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    HUB_HEIGHT_M,
    ROTOR_DIAMETER_M,
    get_v236_ct_curve,
)

# ── CFD Constants ───────────────────────────────────────────────

AIR_DENSITY_KG_M3: float = 1.225
"""Standard air density [kg/m³]."""

ROUGHNESS_LENGTH_M: float = 0.0002
"""Surface roughness for offshore water [m]."""

VON_KARMAN: float = 0.41
"""von Kármán constant [-]."""

C_MU: float = 0.09
"""k-ε turbulence model constant Cμ [-]."""

WAKE_EXPANSION_RATE: float = 0.04
"""Wake expansion coefficient k* for offshore [-]."""


@dataclass(frozen=True)
class MeshSpec:
    """CFD mesh specification.

    Attributes
    ----------
    n_cells : int
        Total number of cells.
    n_cells_x : int
        Cells in streamwise direction.
    n_cells_y : int
        Cells in crosswind direction.
    n_cells_z : int
        Cells in vertical direction.
    min_cell_size_m : float
        Minimum cell size near turbines [m].
    max_cell_size_m : float
        Maximum cell size at boundaries [m].
    domain_x_m : float
        Domain extent in x [m].
    domain_y_m : float
        Domain extent in y [m].
    domain_z_m : float
        Domain height [m].
    refinement_zones : int
        Number of mesh refinement zones around turbines.
    estimated_solve_time_s : float
        Estimated RANS solve time [seconds] (rough estimate).
    """

    n_cells: int
    n_cells_x: int
    n_cells_y: int
    n_cells_z: int
    min_cell_size_m: float
    max_cell_size_m: float
    domain_x_m: float
    domain_y_m: float
    domain_z_m: float
    refinement_zones: int
    estimated_solve_time_s: float


@dataclass(frozen=True)
class ActuatorDiskResult:
    """Actuator disk force and induction for a single turbine.

    Attributes
    ----------
    turbine_index : int
        Turbine index.
    thrust_force_kn : float
        Axial thrust force [kN].
    axial_induction : float
        Axial induction factor a [-].
    disk_averaged_velocity_ms : float
        Velocity at the rotor disk [m/s].
    ct : float
        Thrust coefficient [-].
    """

    turbine_index: int
    thrust_force_kn: float
    axial_induction: float
    disk_averaged_velocity_ms: float
    ct: float


@dataclass(frozen=True)
class TerrainEffect:
    """Terrain-induced flow modification at a turbine location.

    Attributes
    ----------
    turbine_index : int
        Turbine index.
    speed_up_factor : float
        Terrain speed-up factor [-]. 1.0 = flat terrain.
    direction_deflection_deg : float
        Wind direction change from terrain [degrees].
    turbulence_enhancement : float
        TI enhancement factor [-]. 1.0 = no effect.
    elevation_m : float
        Terrain elevation at turbine [m above sea level].
    """

    turbine_index: int
    speed_up_factor: float
    direction_deflection_deg: float
    turbulence_enhancement: float
    elevation_m: float


@dataclass(frozen=True)
class RANSFlowField:
    """Simplified RANS-like velocity field result.

    Attributes
    ----------
    x_grid : NDArray
        X-coordinates of flow field [m].
    y_grid : NDArray
        Y-coordinates at hub height [m].
    u_field : NDArray
        Streamwise velocity at hub height [m/s]. Shape: (ny, nx).
    tke_field : NDArray
        Turbulent kinetic energy [m²/s²]. Shape: (ny, nx).
    pressure_field : NDArray
        Pressure deviation [Pa]. Shape: (ny, nx).
    """

    x_grid: NDArray[np.floating]
    y_grid: NDArray[np.floating]
    u_field: NDArray[np.floating]
    tke_field: NDArray[np.floating]
    pressure_field: NDArray[np.floating]


@dataclass(frozen=True)
class CFDSimulationResult:
    """Complete CFD-style simulation result.

    Attributes
    ----------
    flow_field : RANSFlowField
        RANS velocity and TKE fields at hub height.
    actuator_disks : list[ActuatorDiskResult]
        Per-turbine actuator disk results.
    terrain_effects : list[TerrainEffect]
        Per-turbine terrain effects.
    mesh : MeshSpec
        Mesh specification used.
    farm_power_mw : float
        Total farm power from CFD model [MW].
    total_thrust_kn : float
        Total axial thrust from all turbines [kN].
    mean_tke_m2s2 : float
        Mean TKE in the farm region [m²/s²].
    """

    flow_field: RANSFlowField
    actuator_disks: list[ActuatorDiskResult] = field(default_factory=list)
    terrain_effects: list[TerrainEffect] = field(default_factory=list)
    mesh: MeshSpec | None = None
    farm_power_mw: float = 0.0
    total_thrust_kn: float = 0.0
    mean_tke_m2s2: float = 0.0


def generate_mesh(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    resolution: str = "coarse",
) -> MeshSpec:
    """Generate a CFD mesh specification for the wind farm domain.

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    resolution : str
        "coarse", "medium", or "fine".

    Returns
    -------
    MeshSpec
        Mesh specification.
    """
    # Domain: 5D upstream, 15D downstream, 5D lateral margin
    margin_up = 5.0 * ROTOR_DIAMETER_M
    margin_down = 15.0 * ROTOR_DIAMETER_M
    margin_lat = 5.0 * ROTOR_DIAMETER_M

    x_min = float(np.min(x_positions_m)) - margin_up
    x_max = float(np.max(x_positions_m)) + margin_down
    y_min = float(np.min(y_positions_m)) - margin_lat
    y_max = float(np.max(y_positions_m)) + margin_lat
    z_max = 5.0 * HUB_HEIGHT_M

    domain_x = x_max - x_min
    domain_y = y_max - y_min

    res_map = {"coarse": 3.0, "medium": 1.0, "fine": 0.5}
    base_size = ROTOR_DIAMETER_M * res_map.get(resolution, 1.0)

    nx = max(20, int(domain_x / base_size))
    ny = max(10, int(domain_y / base_size))
    nz = max(10, int(z_max / (base_size * 2)))

    n_cells = nx * ny * nz
    min_cell = ROTOR_DIAMETER_M / 10.0 if resolution == "fine" else ROTOR_DIAMETER_M / 4.0
    n_turbines = len(x_positions_m)

    # Rough solve time estimate: ~0.001s per cell per iteration × 200 iterations
    est_solve = n_cells * 0.001 * 200

    return MeshSpec(
        n_cells=n_cells,
        n_cells_x=nx,
        n_cells_y=ny,
        n_cells_z=nz,
        min_cell_size_m=round(min_cell, 1),
        max_cell_size_m=round(base_size, 1),
        domain_x_m=round(domain_x, 0),
        domain_y_m=round(domain_y, 0),
        domain_z_m=round(z_max, 0),
        refinement_zones=n_turbines,
        estimated_solve_time_s=round(est_solve, 0),
    )


def compute_actuator_disk_forces(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_speed_ms: float = 10.0,
    wind_direction_deg: float = 240.0,
) -> list[ActuatorDiskResult]:
    """Compute actuator disk forces for each turbine.

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    wind_speed_ms : float
        Freestream wind speed [m/s].
    wind_direction_deg : float
        Wind direction [degrees].

    Returns
    -------
    list[ActuatorDiskResult]
        Per-turbine actuator disk results.
    """
    n = len(x_positions_m)
    ws_arr = np.array([wind_speed_ms])
    ct = float(get_v236_ct_curve(ws_arr)[0])
    rotor_area = math.pi * (ROTOR_DIAMETER_M / 2.0) ** 2

    # Axial induction from Ct: a = 0.5(1 - sqrt(1-Ct))
    a = 0.5 * (1.0 - math.sqrt(max(0.0, 1.0 - ct)))
    u_disk = wind_speed_ms * (1.0 - a)

    # Thrust force: F = 0.5 ρ A U² Ct
    thrust_n = 0.5 * AIR_DENSITY_KG_M3 * rotor_area * wind_speed_ms**2 * ct
    thrust_kn = thrust_n / 1000.0

    results = []
    for i in range(n):
        results.append(
            ActuatorDiskResult(
                turbine_index=i,
                thrust_force_kn=round(thrust_kn, 1),
                axial_induction=round(a, 4),
                disk_averaged_velocity_ms=round(u_disk, 2),
                ct=round(ct, 4),
            )
        )

    return results


def compute_terrain_effects(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    terrain_type: str = "offshore_flat",
) -> list[TerrainEffect]:
    """Compute terrain effects on flow at turbine locations.

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    terrain_type : str
        "offshore_flat", "coastal_ridge", or "onshore_complex".

    Returns
    -------
    list[TerrainEffect]
        Per-turbine terrain effects.
    """
    n = len(x_positions_m)
    results = []

    for i in range(n):
        if terrain_type == "offshore_flat":
            speedup = 1.0
            deflection = 0.0
            ti_enhance = 1.0
            elevation = 0.0
        elif terrain_type == "coastal_ridge":
            # Speed-up over coastal ridges (simplified)
            rel_x = (x_positions_m[i] - np.mean(x_positions_m)) / 1000.0
            speedup = 1.0 + 0.1 * np.exp(-(rel_x**2) / 2.0)
            deflection = 2.0 * rel_x
            ti_enhance = 1.0 + 0.05 * abs(rel_x)
            elevation = 20.0 + 10.0 * np.exp(-(rel_x**2) / 2.0)
        else:  # onshore_complex
            rng = np.random.default_rng(42 + i)
            speedup = 1.0 + 0.15 * rng.standard_normal()
            deflection = 5.0 * rng.standard_normal()
            ti_enhance = 1.0 + 0.1 * abs(rng.standard_normal())
            elevation = 50.0 + 30.0 * rng.standard_normal()

        results.append(
            TerrainEffect(
                turbine_index=i,
                speed_up_factor=round(float(speedup), 4),
                direction_deflection_deg=round(float(deflection), 2),
                turbulence_enhancement=round(float(ti_enhance), 4),
                elevation_m=round(float(elevation), 1),
            )
        )

    return results


def run_cfd_simulation(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_speed_ms: float = 10.0,
    wind_direction_deg: float = 240.0,
    turbulence_intensity: float = 0.06,
    terrain_type: str = "offshore_flat",
    resolution: str = "coarse",
) -> CFDSimulationResult:
    """Run simplified RANS-style CFD simulation.

    This is an analytical approximation of a full RANS CFD solve.
    Produces a 2D velocity field at hub height with actuator disk effects.

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    wind_speed_ms : float
        Freestream wind speed [m/s]. Default: 10.0.
    wind_direction_deg : float
        Wind direction [degrees]. Default: 240.0.
    turbulence_intensity : float
        Ambient TI [-]. Default: 0.06.
    terrain_type : str
        Terrain type. Default: "offshore_flat".
    resolution : str
        Mesh resolution. Default: "coarse".

    Returns
    -------
    CFDSimulationResult
        Flow field, actuator disk, and terrain results.
    """
    n = len(x_positions_m)
    mesh = generate_mesh(x_positions_m, y_positions_m, resolution)

    # Create hub-height flow field grid
    margin = 3.0 * ROTOR_DIAMETER_M
    x_min = float(np.min(x_positions_m)) - margin
    x_max = float(np.max(x_positions_m)) + 10.0 * ROTOR_DIAMETER_M
    y_min = float(np.min(y_positions_m)) - margin
    y_max = float(np.max(y_positions_m)) + margin

    nx, ny = min(100, mesh.n_cells_x), min(50, mesh.n_cells_y)
    x_grid = np.linspace(x_min, x_max, nx)
    y_grid = np.linspace(y_min, y_max, ny)
    xx, yy = np.meshgrid(x_grid, y_grid)

    # Initialize uniform flow
    u_field = np.full_like(xx, wind_speed_ms)

    # Background TKE: k = 1.5 × (U × TI)²
    tke_background = 1.5 * (wind_speed_ms * turbulence_intensity) ** 2
    tke_field = np.full_like(xx, tke_background)

    # Pressure field (initialize to 0)
    p_field = np.zeros_like(xx)

    # Apply actuator disk deficits to flow field
    wind_rad = np.radians(wind_direction_deg)
    ws_arr = np.array([wind_speed_ms])
    ct = float(get_v236_ct_curve(ws_arr)[0])
    # Induction factor from Ct — used in actuator disk pressure drop below
    induction = 0.5 * (1.0 - math.sqrt(max(0.0, 1.0 - ct)))

    for t_idx in range(n):
        tx, ty = x_positions_m[t_idx], y_positions_m[t_idx]

        # Downstream distance from turbine along wind direction
        dx = (xx - tx) * np.sin(wind_rad) + (yy - ty) * np.cos(wind_rad)
        # Lateral distance
        dy_lat = (xx - tx) * np.cos(wind_rad) - (yy - ty) * np.sin(wind_rad)

        # Only apply wake downstream
        downstream = dx > 0
        wake_width = ROTOR_DIAMETER_M / 2.0 + WAKE_EXPANSION_RATE * dx
        wake_mask = downstream & (np.abs(dy_lat) < wake_width)

        # Gaussian deficit profile — apply only within wake region
        sigma = wake_width / 2.35  # FWHM to sigma
        sigma = np.maximum(sigma, ROTOR_DIAMETER_M / 4.0)
        deficit = (1.0 - math.sqrt(1.0 - ct)) * np.exp(-(dy_lat**2) / (2.0 * sigma**2))
        deficit *= wake_mask.astype(float)

        u_field -= wind_speed_ms * deficit

        # Wake-added TKE
        tke_wake = 0.5 * wind_speed_ms**2 * deficit**2
        tke_field += tke_wake

        # Pressure drop across actuator disk: Δp = 2ρU²a(1-a)
        disk_region = (np.abs(dx) < ROTOR_DIAMETER_M / 4.0) & (
            np.abs(dy_lat) < ROTOR_DIAMETER_M / 2.0
        )
        p_field[disk_region] -= (
            0.5 * AIR_DENSITY_KG_M3 * wind_speed_ms**2 * 4.0 * induction * (1.0 - induction)
        )

    u_field = np.maximum(u_field, 0.5)  # Floor at 0.5 m/s

    # Actuator disk forces
    ad_results = compute_actuator_disk_forces(
        x_positions_m,
        y_positions_m,
        wind_speed_ms,
        wind_direction_deg,
    )

    # Terrain effects
    terrain_results = compute_terrain_effects(x_positions_m, y_positions_m, terrain_type)

    # Farm power from flow field (interpolate at turbine locations)
    from app.services.p1.wake_model import get_v236_power_curve_kw

    total_power = 0.0
    for t_idx in range(n):
        # Simple nearest-grid interpolation
        ix = np.argmin(np.abs(x_grid - x_positions_m[t_idx]))
        iy = np.argmin(np.abs(y_grid - y_positions_m[t_idx]))
        u_turb = float(u_field[iy, ix])
        u_turb *= terrain_results[t_idx].speed_up_factor
        p_kw = float(get_v236_power_curve_kw(np.array([max(3.0, u_turb)]))[0])
        total_power += p_kw / 1000.0

    total_thrust = sum(ad.thrust_force_kn for ad in ad_results)
    mean_tke = float(np.mean(tke_field))

    flow_field = RANSFlowField(
        x_grid=x_grid.astype(np.float64),
        y_grid=y_grid.astype(np.float64),
        u_field=np.round(u_field, 2).astype(np.float64),
        tke_field=np.round(tke_field, 4).astype(np.float64),
        pressure_field=np.round(p_field, 1).astype(np.float64),
    )

    return CFDSimulationResult(
        flow_field=flow_field,
        actuator_disks=ad_results,
        terrain_effects=terrain_results,
        mesh=mesh,
        farm_power_mw=round(total_power, 3),
        total_thrust_kn=round(total_thrust, 1),
        mean_tke_m2s2=round(mean_tke, 4),
    )
