"""
Wind farm global blockage: engineering estimate through the power curve.

Physics
-------
Global blockage is the large-scale slowdown of the incoming wind upstream of
a farm: the array acts as a porous obstacle whose pressure field decelerates
the flow before it reaches the first row. Field and LES studies report
AEP effects of the order of 1–4 % for large offshore arrays (Bleeg et al.
2018); it grows with how densely the rotors fill the farm area and with how
hard each rotor pushes on the flow (thrust coefficient Ct).

Model (educational engineering scaling — not a published closed form)
---------------------------------------------------------------------
Fractional free-stream speed deficit seen by the farm:

    δ(v) = (α / 3) · ρ_array · Ct(v)

    ρ_array = N · (π/4) · D² / A_farm      (rotor area / convex-hull area)

The deficit is then passed through the V236 power curve and weighted by the
Weibull distribution, so the AEP loss is

    L = 1 − ∫ P(v·(1−δ(v))) f(v) dv / ∫ P(v) f(v) dv

Below rated P ∝ v³, so ΔP/P ≈ 3δ = α·ρ_array·Ct — α is the loss per unit
"thrust density". Above rated a small deficit costs nothing (the turbine is
still at 15 MW), which is why a single Ct at the mean speed overstates it.
α = 2.5 is a calibration constant chosen so typical offshore layouts land
in the published 1–4 % band; replace it with a site-specific value from a
RANS/LES blockage study for bankable work.

References
----------
- Bleeg, J. et al. (2018). Wind farm blockage and the consequences of
  neglecting its impact on energy production. Energies 11(6), 1609.
- Nygaard, N.G. et al. (2020). Modelling cluster wakes and wind farm
  blockage. J. Phys.: Conf. Ser. 1618, 062072.
- IEC 61400-15-1 — energy yield assessment should account for blockage.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# Calibration constant (see module docstring) — energy loss per unit
# array density × Ct for below-rated operation.
_BLOCKAGE_ALPHA: float = 2.5
METHOD = "density_ct_power_curve"


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
        Energy-weighted thrust coefficient ∫Ct·P·f dv / ∫P·f dv [-].
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
    mean_wind_speed_ms: float = 9.3,
    weibull_k: float = 2.2,
) -> BlockageResult:
    """Estimate the global-blockage AEP loss (see module docstring).

    Parameters
    ----------
    num_turbines : int
        Number of turbines.
    x_positions, y_positions : NDArray
        Turbine coordinates [m].
    rotor_diameter_m : float
        Rotor diameter [m]. Default: 236.0 (V236-15.0).
    mean_wind_speed_ms : float
        Long-term mean hub-height wind speed [m/s].
    weibull_k : float
        Weibull shape factor [-]; A = v̄ / Γ(1 + 1/k).

    Returns
    -------
    BlockageResult
        AEP loss [%], array density, energy-weighted Ct, farm area.
    """
    from app.services.p1.wake_model import get_v236_ct_curve, get_v236_power_curve_kw

    a = mean_wind_speed_ms / math.gamma(1.0 + 1.0 / weibull_k)
    v = np.linspace(0.0, 35.0, 1401)
    pdf = (weibull_k / a) * (v / a) ** (weibull_k - 1) * np.exp(-((v / a) ** weibull_k))
    ct = get_v236_ct_curve(v)
    p_free = get_v236_power_curve_kw(v)
    e_free = float(np.trapezoid(p_free * pdf, v))
    mean_ct = float(np.trapezoid(ct * p_free * pdf, v) / e_free)

    farm_area_km2 = _compute_convex_hull_area_km2(x_positions, y_positions)
    if farm_area_km2 <= 0:  # < 3 turbines or collinear: no farm-scale blockage
        return BlockageResult(0.0, 0.0, mean_ct, 0.0, METHOD)

    density = compute_array_density(num_turbines, rotor_diameter_m, farm_area_km2)
    deficit = (_BLOCKAGE_ALPHA / 3.0) * density * ct
    p_blocked = get_v236_power_curve_kw(v * (1.0 - deficit))
    loss = 1.0 - float(np.trapezoid(p_blocked * pdf, v)) / e_free

    return BlockageResult(
        blockage_loss_percent=loss * 100.0,
        array_density=density,
        mean_ct=mean_ct,
        farm_area_km2=farm_area_km2,
        method=METHOD,
    )
