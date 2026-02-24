"""
Wind farm blockage effect: empirical model per Nygaard et al. (2020).

Physics
-------
Wind farm blockage (also called "global blockage") is the large-scale
deceleration of wind upstream of a wind farm. The farm acts as a porous
obstacle, creating a pressure field that slows incoming flow before it
reaches the first row of turbines. This is distinct from individual
turbine induction (near-field) blockage.

The effect depends on:
- Array density: how closely packed the turbines are relative to the farm area
- Thrust coefficient: how much momentum each turbine extracts from the flow
- Number of turbines: larger arrays create stronger collective blockage

Standard
--------
- Nygaard, N.G. et al. (2020): "Modelling cluster wakes and wind farm blockage"
  Journal of Physics: Conference Series, 1618, 062072.
- IEC 61400-15 (draft): Assessment of wind resource, energy yield, and
  site suitability for wind power plants — recommends accounting for blockage.

Maths
-----
Empirical blockage model (Nygaard et al. 2020):

    blockage_loss = alpha * array_density * mean_Ct

Where:
- alpha = 2.5 (empirical coefficient, calibrated to LES simulations)
- array_density = n_turbines * A_rotor / A_farm
    - A_rotor = pi/4 * D^2  (rotor swept area)
    - A_farm = convex hull area of turbine positions
- mean_Ct = average thrust coefficient at mean hub-height wind speed

Typical result for 34 V236-15.0 MW turbines: 1.5-2.5% blockage loss.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# Empirical coefficient from Nygaard et al. (2020), calibrated to LES results.
# Value of 2.5 gives 1.5-2.5% blockage for typical offshore arrays — consistent
# with DNV recommendations and validation against LES data.
_BLOCKAGE_ALPHA: float = 2.5


@dataclass(frozen=True)
class BlockageResult:
    """Wind farm blockage analysis result.

    Attributes
    ----------
    blockage_loss_percent : float
        Estimated blockage loss [%].
    array_density : float
        Array density [-]: total rotor area / farm area.
    mean_ct : float
        Mean thrust coefficient at hub-height wind speed [-].
    farm_area_km2 : float
        Farm footprint area from convex hull [km2].
    method : str
        Model identification string.
    """

    blockage_loss_percent: float
    array_density: float
    mean_ct: float
    farm_area_km2: float
    method: str


def compute_array_density(
    num_turbines: int,
    rotor_diameter_m: float,
    farm_area_km2: float,
) -> float:
    """Compute array density: total rotor swept area / farm footprint area.

    Parameters
    ----------
    num_turbines : int
        Number of turbines in the farm.
    rotor_diameter_m : float
        Rotor diameter [m].
    farm_area_km2 : float
        Farm footprint area [km2].

    Returns
    -------
    float
        Array density [-]. Dimensionless ratio, typically 0.01-0.10.
    """
    if farm_area_km2 <= 0:
        return 0.0
    rotor_area_m2 = np.pi / 4.0 * rotor_diameter_m**2
    total_rotor_area_m2 = num_turbines * rotor_area_m2
    farm_area_m2 = farm_area_km2 * 1e6
    return float(total_rotor_area_m2 / farm_area_m2)


def _compute_convex_hull_area_km2(
    x_positions: NDArray[np.floating],
    y_positions: NDArray[np.floating],
) -> float:
    """Compute convex hull area of turbine positions.

    Parameters
    ----------
    x_positions : NDArray
        Turbine x-coordinates [m].
    y_positions : NDArray
        Turbine y-coordinates [m].

    Returns
    -------
    float
        Convex hull area [km2]. Returns 0.0 for < 3 turbines.
    """
    from scipy.spatial import ConvexHull

    n = len(x_positions)
    if n < 3:
        return 0.0

    points = np.column_stack((x_positions, y_positions))

    # Check for collinear points (ConvexHull needs non-degenerate geometry)
    try:
        hull = ConvexHull(points)
    except Exception:
        return 0.0

    return float(hull.volume / 1e6)  # m2 → km2 (ConvexHull.volume = area in 2D)


def estimate_blockage_loss_percent(
    num_turbines: int,
    x_positions: NDArray[np.floating],
    y_positions: NDArray[np.floating],
    rotor_diameter_m: float = 236.0,
    mean_wind_speed_ms: float = 10.5,
) -> BlockageResult:
    """Estimate wind farm blockage loss using empirical Nygaard (2020) model.

    Parameters
    ----------
    num_turbines : int
        Number of turbines.
    x_positions : NDArray
        Turbine x-coordinates [m].
    y_positions : NDArray
        Turbine y-coordinates [m].
    rotor_diameter_m : float
        Rotor diameter [m]. Default: 236.0 (V236-15.0).
    mean_wind_speed_ms : float
        Mean hub-height wind speed [m/s]. Default: 10.5 (Baltic).

    Returns
    -------
    BlockageResult
        Blockage loss estimate with supporting parameters.
    """
    from app.services.p1.wake_model import get_v236_ct_curve

    # Farm area via convex hull
    farm_area_km2 = _compute_convex_hull_area_km2(x_positions, y_positions)

    # Handle degenerate cases (< 3 turbines or zero area)
    if farm_area_km2 <= 0:
        mean_ct = float(get_v236_ct_curve(np.array([mean_wind_speed_ms]))[0])
        return BlockageResult(
            blockage_loss_percent=0.0,
            array_density=0.0,
            mean_ct=mean_ct,
            farm_area_km2=0.0,
            method="nygaard_2020",
        )

    # Array density
    density = compute_array_density(num_turbines, rotor_diameter_m, farm_area_km2)

    # Mean Ct at hub-height wind speed
    mean_ct = float(get_v236_ct_curve(np.array([mean_wind_speed_ms]))[0])

    # Blockage loss: alpha * density * Ct
    blockage_pct = _BLOCKAGE_ALPHA * density * mean_ct * 100.0

    return BlockageResult(
        blockage_loss_percent=blockage_pct,
        array_density=density,
        mean_ct=mean_ct,
        farm_area_km2=farm_area_km2,
        method="nygaard_2020",
    )
