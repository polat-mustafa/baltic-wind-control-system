"""
Wind farm layout generation and optimization for 34 × V236-15.0 MW turbines.

Physics
-------
Turbine layout determines wake interactions and thus energy yield. Key
physical constraints:

- **Minimum spacing**: 5D (5 × 236 = 1180 m) between any pair of turbines,
  to limit structural fatigue from wake turbulence (IEC 61400-1).
- **Prevailing wind**: Rows aligned perpendicular to the predominant wind
  direction minimize wake losses. For Baltic Sea → WSW (255°).
- **Staggering**: Alternate-row offsets of 0.5 × crosswind spacing reduce
  direct wake alignment, cutting wake losses by ~20-30%.
- **Optimization**: Differential evolution explores the non-convex, multi-modal
  search space of turbine positions to maximize net AEP.

Standard
--------
- IEC 61400-1: Minimum spacing for turbulence (typically ≥ 5D)
- DNV-RP-0003: Layout optimization best practices
- Industry convention: 5-8D streamwise, 3-5D crosswind spacing

Maths
-----
**Regular grid**: Place turbines on Nx × Ny grid with:
    dx = 5D (streamwise), dy = 8D (crosswind)
    Select first `n_turbines` positions.

**Staggered grid**: Offset alternate rows by 0.5 × dy, then rotate
    entire layout so rows face perpendicular to prevailing wind.

**Optimization**: scipy.optimize.differential_evolution
    Objective: maximize net AEP (minimize -AEP)
    Variables: (x1, y1, x2, y2, ..., xN, yN)
    Constraint: min pairwise distance ≥ 5D = 1180 m
    Bounds: initial bounding box + 2D margin

**Pairwise distances** (vectorized):
    d_ij = sqrt((x_i - x_j)^2 + (y_i - y_j)^2) for all i < j
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import ROTOR_DIAMETER_M

# ── Layout Constants ──────────────────────────────────────────────

MIN_SPACING_DIAMETERS: float = 5.0
MIN_SPACING_M: float = MIN_SPACING_DIAMETERS * ROTOR_DIAMETER_M  # 1180 m
DEFAULT_NUM_TURBINES: int = 34
STREAMWISE_SPACING_D: float = 5.0  # 5D spacing along wind direction
CROSSWIND_SPACING_D: float = 8.0  # 8D spacing perpendicular to wind


@dataclass(frozen=True)
class LayoutResult:
    """Wind farm layout result.

    Attributes
    ----------
    name : str
        Layout variant name (e.g., "Regular Grid", "Staggered", "Optimized").
    x_positions : NDArray
        Turbine x-coordinates [m]. Shape: (num_turbines,).
    y_positions : NDArray
        Turbine y-coordinates [m]. Shape: (num_turbines,).
    num_turbines : int
        Number of turbines placed.
    min_spacing_m : float
        Minimum pairwise distance between any two turbines [m].
    area_km2 : float
        Convex hull area of the layout [km2].
    """

    name: str
    x_positions: NDArray[np.floating]
    y_positions: NDArray[np.floating]
    num_turbines: int
    min_spacing_m: float
    area_km2: float


# ── Utility Functions ─────────────────────────────────────────────


def compute_pairwise_distances_m(
    x: NDArray[np.floating],
    y: NDArray[np.floating],
) -> NDArray[np.floating]:
    """Compute pairwise Euclidean distance matrix between all turbines.

    Parameters
    ----------
    x : NDArray
        Turbine x-coordinates [m]. Shape: (n,).
    y : NDArray
        Turbine y-coordinates [m]. Shape: (n,).

    Returns
    -------
    NDArray
        Distance matrix [m]. Shape: (n, n). Diagonal = 0.
    """
    dx = x[:, np.newaxis] - x[np.newaxis, :]
    dy = y[:, np.newaxis] - y[np.newaxis, :]
    result: NDArray[np.floating] = np.sqrt(dx**2 + dy**2).astype(np.float64)
    return result


def check_minimum_spacing(
    x: NDArray[np.floating],
    y: NDArray[np.floating],
    min_distance_m: float = MIN_SPACING_M,
) -> tuple[bool, float]:
    """Check if all turbine pairs meet minimum spacing requirement.

    Parameters
    ----------
    x : NDArray
        Turbine x-coordinates [m].
    y : NDArray
        Turbine y-coordinates [m].
    min_distance_m : float
        Minimum allowed distance [m]. Default: 1180 (5D).

    Returns
    -------
    tuple[bool, float]
        (passes_check, actual_minimum_distance_m).
    """
    if len(x) < 2:
        return True, float("inf")

    dist_matrix = compute_pairwise_distances_m(x, y)
    # Set diagonal to inf so it's excluded from min
    np.fill_diagonal(dist_matrix, np.inf)
    actual_min = float(np.min(dist_matrix))
    return actual_min >= min_distance_m, actual_min


def _compute_layout_area_km2(
    x: NDArray[np.floating],
    y: NDArray[np.floating],
) -> float:
    """Compute convex hull area of layout positions.

    Parameters
    ----------
    x, y : NDArray
        Turbine coordinates [m].

    Returns
    -------
    float
        Convex hull area [km2]. Returns 0 for < 3 turbines.
    """
    if len(x) < 3:
        return 0.0

    from scipy.spatial import ConvexHull

    points = np.column_stack((x, y))
    try:
        hull = ConvexHull(points)
    except Exception:
        return 0.0

    return float(hull.volume / 1e6)  # m2 → km2


# ── Layout Generators ─────────────────────────────────────────────


def generate_regular_grid(
    num_turbines: int = DEFAULT_NUM_TURBINES,
    streamwise_d: float = STREAMWISE_SPACING_D,
    crosswind_d: float = CROSSWIND_SPACING_D,
) -> LayoutResult:
    """Generate a regular (aligned rows) grid layout.

    Places turbines on a rectangular grid with streamwise spacing along x
    and crosswind spacing along y. Uses a 6-column grid to place 34 turbines.

    Parameters
    ----------
    num_turbines : int
        Number of turbines. Default: 34.
    streamwise_d : float
        Streamwise spacing in rotor diameters. Default: 5.0.
    crosswind_d : float
        Crosswind spacing in rotor diameters. Default: 8.0.

    Returns
    -------
    LayoutResult
        Regular grid layout.
    """
    dx = streamwise_d * ROTOR_DIAMETER_M
    dy = crosswind_d * ROTOR_DIAMETER_M

    # 6 columns, enough rows to fit num_turbines
    n_cols = 6
    n_rows = int(np.ceil(num_turbines / n_cols))

    x_grid, y_grid = np.meshgrid(
        np.arange(n_cols) * dx,
        np.arange(n_rows) * dy,
    )
    x_all = x_grid.ravel()[:num_turbines].astype(np.float64)
    y_all = y_grid.ravel()[:num_turbines].astype(np.float64)

    _, min_dist = check_minimum_spacing(x_all, y_all)
    area = _compute_layout_area_km2(x_all, y_all)

    return LayoutResult(
        name="Regular Grid",
        x_positions=x_all,
        y_positions=y_all,
        num_turbines=num_turbines,
        min_spacing_m=min_dist,
        area_km2=area,
    )


def generate_staggered_grid(
    num_turbines: int = DEFAULT_NUM_TURBINES,
    predominant_direction_deg: float = 255.0,
    streamwise_d: float = STREAMWISE_SPACING_D,
    crosswind_d: float = CROSSWIND_SPACING_D,
) -> LayoutResult:
    """Generate a staggered grid layout rotated to prevailing wind direction.

    Alternate rows are offset by 0.5 × crosswind spacing, reducing direct
    wake alignment. The entire layout is then rotated so that rows face
    perpendicular to the predominant wind direction.

    Parameters
    ----------
    num_turbines : int
        Number of turbines. Default: 34.
    predominant_direction_deg : float
        Predominant wind direction [degrees, meteorological convention].
        Default: 255.0 (WSW, typical Baltic).
    streamwise_d : float
        Streamwise spacing in rotor diameters. Default: 5.0.
    crosswind_d : float
        Crosswind spacing in rotor diameters. Default: 8.0.

    Returns
    -------
    LayoutResult
        Staggered grid layout.
    """
    dx = streamwise_d * ROTOR_DIAMETER_M
    dy = crosswind_d * ROTOR_DIAMETER_M

    n_cols = 6
    n_rows = int(np.ceil(num_turbines / n_cols))

    positions_x: list[float] = []
    positions_y: list[float] = []
    for row in range(n_rows):
        for col in range(n_cols):
            if len(positions_x) >= num_turbines:
                break
            x = col * dx
            y = row * dy
            # Stagger: offset odd rows by half crosswind spacing
            if row % 2 == 1:
                x += 0.5 * dx
            positions_x.append(x)
            positions_y.append(y)

    x_arr = np.array(positions_x, dtype=np.float64)
    y_arr = np.array(positions_y, dtype=np.float64)

    # Rotate layout to align rows perpendicular to prevailing wind
    # Meteorological convention: 255° means wind comes FROM 255° (WSW)
    # Rotate by -(predominant_direction - 270) to align rows crosswind
    angle_rad = np.radians(predominant_direction_deg - 270.0)
    cos_a = np.cos(angle_rad)
    sin_a = np.sin(angle_rad)

    # Center, rotate, re-center
    cx, cy = x_arr.mean(), y_arr.mean()
    x_c = x_arr - cx
    y_c = y_arr - cy
    x_rot = x_c * cos_a - y_c * sin_a + cx
    y_rot = x_c * sin_a + y_c * cos_a + cy

    _, min_dist = check_minimum_spacing(x_rot, y_rot)
    area = _compute_layout_area_km2(x_rot, y_rot)

    return LayoutResult(
        name="Staggered",
        x_positions=x_rot,
        y_positions=y_rot,
        num_turbines=num_turbines,
        min_spacing_m=min_dist,
        area_km2=area,
    )


# ── Layout Optimization ──────────────────────────────────────────


def optimize_layout(
    initial_x: NDArray[np.floating],
    initial_y: NDArray[np.floating],
    site: Any,
    maxiter: int = 50,
    seed: int = 42,
    penalty_weight: float = 1e6,
) -> LayoutResult:
    """Optimize turbine layout using differential evolution to maximize net AEP.

    Uses scipy.optimize.differential_evolution with a penalty for violating
    the minimum spacing constraint (5D = 1180 m).

    Parameters
    ----------
    initial_x : NDArray
        Initial turbine x-coordinates [m].
    initial_y : NDArray
        Initial turbine y-coordinates [m].
    site : py_wake.site.BaseSite
        PyWake site object.
    maxiter : int
        Maximum number of DE generations. Default: 50.
    seed : int
        Random seed for reproducibility. Default: 42.
    penalty_weight : float
        Penalty multiplier for spacing violations. Default: 1e6.

    Returns
    -------
    LayoutResult
        Optimized layout with highest net AEP found.
    """
    from scipy.optimize import differential_evolution

    from app.services.p1.wake_model import (
        create_v236_wind_turbine,
        run_wake_analysis,
    )

    n = len(initial_x)
    turbine = create_v236_wind_turbine()

    # Bounds: initial bounding box + 2D margin on each side
    margin = 2.0 * ROTOR_DIAMETER_M
    x_min = float(np.min(initial_x)) - margin
    x_max = float(np.max(initial_x)) + margin
    y_min = float(np.min(initial_y)) - margin
    y_max = float(np.max(initial_y)) + margin

    bounds = [(x_min, x_max), (y_min, y_max)] * n

    def objective(params: NDArray[np.floating]) -> float:
        """Objective: minimize negative AEP + spacing penalty."""
        x = params[0::2]
        y = params[1::2]

        # Penalty for spacing violations
        passes, actual_min = check_minimum_spacing(np.array(x), np.array(y), MIN_SPACING_M)
        penalty = 0.0
        if not passes:
            violation = MIN_SPACING_M - actual_min
            penalty = penalty_weight * violation**2

        # Run wake analysis
        try:
            result = run_wake_analysis(
                np.array(x, dtype=np.float64),
                np.array(y, dtype=np.float64),
                site,
                turbine,
            )
            return -result.net_aep_gwh + penalty
        except Exception:
            return 1e12  # Large value for failed simulations

    # Initial guess: interleave x and y
    x0 = np.empty(2 * n, dtype=np.float64)
    x0[0::2] = initial_x
    x0[1::2] = initial_y

    result = differential_evolution(
        objective,
        bounds=bounds,
        maxiter=maxiter,
        seed=seed,
        init="sobol",
        tol=1e-4,
        polish=False,
        x0=x0,
    )

    opt_x = result.x[0::2].astype(np.float64)
    opt_y = result.x[1::2].astype(np.float64)

    _, min_dist = check_minimum_spacing(opt_x, opt_y)
    area = _compute_layout_area_km2(opt_x, opt_y)

    return LayoutResult(
        name="Optimized",
        x_positions=opt_x,
        y_positions=opt_y,
        num_turbines=n,
        min_spacing_m=min_dist,
        area_km2=area,
    )
