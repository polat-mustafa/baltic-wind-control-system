"""
Wake modeling: V236-15.0 MW turbine definition + PyWake BPA Gaussian wake analysis.

This module defines the Vestas V236-15.0 MW turbine power and thrust curves
and wraps PyWake to run wake-effect simulations for the 34-turbine Baltic
Wind Alpha layout.

Physics
-------
Wake effects reduce downstream wind speed. The Bastankhah-Porté-Agel (BPA)
Gaussian model assumes the velocity deficit follows a Gaussian profile that
expands linearly downstream. Wake superposition uses linear summation.

Key equations:
- Wake deficit: ΔU/U₀ = (1 - √(1 - Ct/(8(σ/D)²)))
- Wake expansion: σ(x) = k*x + D/√8, where k* = 0.3837·TI + 0.003678
- Linear superposition: total deficit = Σ individual deficits

Turbine: Vestas V236-15.0 MW
-----------------------------
- Rotor diameter: 236 m
- Hub height: 150 m
- Cut-in / rated / cut-out: 3 / 12.5 / 31 m/s
- Rated power: 15,000 kW (15 MW)

References
----------
- Bastankhah, M. & Porté-Agel, F. (2014). J. Fluid Mech., 781, 706-730.
- IEC 61400-12-1: Power performance measurement
- Vestas V236-15.0 MW specification (public data sheet)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

# ── Turbine Specification Constants ────────────────────────────────

ROTOR_DIAMETER_M: float = 236.0
HUB_HEIGHT_M: float = 150.0
RATED_POWER_KW: float = 15_000.0
CUT_IN_SPEED_MS: float = 3.0
RATED_SPEED_MS: float = 12.5
CUT_OUT_SPEED_MS: float = 31.0

# Power curve data points [m/s, kW]
# Based on V236-15.0 MW public specification (simplified for educational use)
_POWER_CURVE_SPEEDS_MS: NDArray[np.floating] = np.array(
    [
        0.0,
        2.0,
        3.0,
        4.0,
        5.0,
        6.0,
        7.0,
        8.0,
        9.0,
        10.0,
        10.5,
        11.0,
        11.5,
        12.0,
        12.5,
        13.0,
        14.0,
        15.0,
        16.0,
        18.0,
        20.0,
        22.0,
        24.0,
        26.0,
        28.0,
        30.0,
        31.0,
        32.0,
    ],
    dtype=np.float64,
)

_POWER_CURVE_KW: NDArray[np.floating] = np.array(
    [
        0.0,
        0.0,
        200.0,
        700.0,
        1500.0,
        2700.0,
        4200.0,
        6100.0,
        8300.0,
        10500.0,
        11400.0,
        12400.0,
        13300.0,
        14200.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        15000.0,
        0.0,
    ],
    dtype=np.float64,
)

# Thrust coefficient curve data points [m/s, Ct]
_CT_CURVE_SPEEDS_MS: NDArray[np.floating] = np.array(
    [
        0.0,
        2.0,
        3.0,
        4.0,
        5.0,
        6.0,
        7.0,
        8.0,
        9.0,
        10.0,
        10.5,
        11.0,
        11.5,
        12.0,
        12.5,
        13.0,
        14.0,
        15.0,
        16.0,
        18.0,
        20.0,
        22.0,
        24.0,
        26.0,
        28.0,
        30.0,
        31.0,
        32.0,
    ],
    dtype=np.float64,
)

_CT_CURVE_VALUES: NDArray[np.floating] = np.array(
    [
        0.0,
        0.0,
        0.90,
        0.88,
        0.85,
        0.82,
        0.78,
        0.72,
        0.60,
        0.45,
        0.40,
        0.36,
        0.33,
        0.30,
        0.28,
        0.25,
        0.20,
        0.17,
        0.14,
        0.10,
        0.08,
        0.06,
        0.05,
        0.04,
        0.04,
        0.03,
        0.03,
        0.0,
    ],
    dtype=np.float64,
)


@dataclass(frozen=True)
class WakeAnalysisResult:
    """Wake analysis result for a wind farm layout.

    Attributes
    ----------
    gross_aep_gwh : float
        Gross AEP without wake losses [GWh/year].
    net_aep_gwh : float
        Net AEP after wake losses [GWh/year].
    wake_loss_percent : float
        Wake loss as percentage of gross AEP [%].
    per_turbine_aep_gwh : NDArray
        Net AEP for each turbine [GWh/year]. Shape: (n_turbines,).
    per_turbine_wake_loss_percent : NDArray
        Wake loss for each turbine [%]. Shape: (n_turbines,).
    capacity_factor : float
        Net capacity factor [-], 0–1. CF = net_AEP / (P_rated × 8760 × n_turbines).
    """

    gross_aep_gwh: float
    net_aep_gwh: float
    wake_loss_percent: float
    per_turbine_aep_gwh: NDArray[np.floating]
    per_turbine_wake_loss_percent: NDArray[np.floating]
    capacity_factor: float


# ── Pure NumPy Functions (no PyWake dependency) ────────────────────


def get_v236_power_curve_kw(
    wind_speeds_ms: NDArray[np.floating],
) -> NDArray[np.floating]:
    """
    Compute V236-15.0 MW power output via interpolation + physics clipping.

    Rule 1 enforced: P ≥ 0 and P ≤ P_rated. Zero power below cut-in
    and above cut-out.

    Parameters
    ----------
    wind_speeds_ms : NDArray
        Wind speed values [m/s].

    Returns
    -------
    NDArray
        Power output [kW]. Clipped to [0, RATED_POWER_KW].
    """
    power_kw = np.interp(wind_speeds_ms, _POWER_CURVE_SPEEDS_MS, _POWER_CURVE_KW)

    # Physics clipping (Rule 1: physical constraints are non-negotiable)
    power_kw = np.clip(power_kw, 0.0, RATED_POWER_KW)
    power_kw = np.where(wind_speeds_ms < CUT_IN_SPEED_MS, 0.0, power_kw)
    power_kw = np.where(wind_speeds_ms > CUT_OUT_SPEED_MS, 0.0, power_kw)

    result: NDArray[np.floating] = power_kw.astype(np.float64)
    return result


def get_v236_ct_curve(
    wind_speeds_ms: NDArray[np.floating],
) -> NDArray[np.floating]:
    """
    Compute V236-15.0 MW thrust coefficient via interpolation.

    Parameters
    ----------
    wind_speeds_ms : NDArray
        Wind speed values [m/s].

    Returns
    -------
    NDArray
        Thrust coefficient [-]. Clamped to [0, 1].
    """
    ct = np.interp(wind_speeds_ms, _CT_CURVE_SPEEDS_MS, _CT_CURVE_VALUES)

    # Physical constraint: Ct must be in [0, 1]
    ct = np.clip(ct, 0.0, 1.0)

    # Zero outside operating range
    ct = np.where(wind_speeds_ms < CUT_IN_SPEED_MS, 0.0, ct)
    ct = np.where(wind_speeds_ms > CUT_OUT_SPEED_MS, 0.0, ct)

    result: NDArray[np.floating] = ct.astype(np.float64)
    return result


# ── PyWake Integration Functions ───────────────────────────────────


def create_v236_wind_turbine() -> Any:
    """
    Create a PyWake WindTurbine object for the Vestas V236-15.0 MW.

    Uses PowerCtTabular with the hardcoded power and Ct curves.

    Returns
    -------
    py_wake.wind_turbines.WindTurbine
        PyWake turbine object.
    """
    from py_wake.wind_turbines import WindTurbine
    from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

    return WindTurbine(
        name="V236-15.0",
        diameter=ROTOR_DIAMETER_M,
        hub_height=HUB_HEIGHT_M,
        powerCtFunction=PowerCtTabular(
            ws=_POWER_CURVE_SPEEDS_MS,
            power=_POWER_CURVE_KW * 1e3,  # PowerCtTabular expects watts
            power_unit="W",
            ct=_CT_CURVE_VALUES,
        ),
    )


def create_uniform_site(
    weibull_a_ms: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
) -> Any:
    """
    Create a PyWake site with uniform Weibull wind distribution.

    Uses UniformWeibullSite with equal probability across all sectors
    and identical Weibull parameters per sector (omnidirectional).

    Parameters
    ----------
    weibull_a_ms : float
        Weibull scale parameter A [m/s]. Default: 10.5 (Baltic).
    weibull_k : float
        Weibull shape parameter k [-]. Default: 2.2 (Baltic).
    turbulence_intensity : float
        Ambient turbulence intensity [-]. Default: 0.06 (typical offshore).

    Returns
    -------
    py_wake.site.UniformWeibullSite
        PyWake site with uniform omnidirectional Weibull wind.
    """
    from py_wake.site import UniformWeibullSite

    num_sectors = 12
    return UniformWeibullSite(
        p_wd=[1.0 / num_sectors] * num_sectors,
        a=[weibull_a_ms] * num_sectors,
        k=[weibull_k] * num_sectors,
        ti=turbulence_intensity,
    )


def create_site_from_wind_rose(
    wind_rose_result: object,
    turbulence_intensity: float = 0.06,
) -> Any:
    """
    Create a PyWake site from a WindRoseResult with sector Weibull parameters.

    Parameters
    ----------
    wind_rose_result : WindRoseResult
        Wind rose analysis result with sector frequencies and Weibull fits.
    turbulence_intensity : float
        Ambient turbulence intensity [-]. Default: 0.06.

    Returns
    -------
    py_wake.site.UniformWeibullSite
        PyWake site configured with directional wind statistics.
    """
    from py_wake.site import UniformWeibullSite

    # Import here to access type
    from app.services.p1.wind_analysis import WindRoseResult

    if not isinstance(wind_rose_result, WindRoseResult):
        msg = f"Expected WindRoseResult, got {type(wind_rose_result)}"
        raise TypeError(msg)

    wr = wind_rose_result
    num_sectors = wr.num_sectors

    # Extract Weibull A and k per sector, using defaults for failed fits
    sector_a = np.zeros(num_sectors, dtype=np.float64)
    sector_k = np.zeros(num_sectors, dtype=np.float64)
    for i in range(num_sectors):
        weibull_i = wr.sector_weibull[i]
        if weibull_i is not None:
            sector_a[i] = weibull_i.scale_a_ms
            sector_k[i] = weibull_i.shape_k
        else:
            # Fallback: use overall mean speed and k=2.0
            sector_a[i] = float(np.nanmean(wr.mean_speeds_ms))
            sector_k[i] = 2.0

    return UniformWeibullSite(
        p_wd=wr.frequencies,
        a=sector_a,
        k=sector_k,
        ti=turbulence_intensity,
    )


def configure_wake_model(site: Any, turbine: Any) -> Any:
    """
    Configure PyWake BPA Gaussian wake model with linear superposition.

    Uses the Bastankhah-Porté-Agel (2014) Gaussian deficit model with:
    - LinearSum superposition (industry standard for offshore)
    - STF2017 turbulence model (Frandsen-based, accounts for added TI in wakes)

    Parameters
    ----------
    site : py_wake.site.BaseSite
        PyWake site object.
    turbine : py_wake.wind_turbines.WindTurbine
        PyWake turbine object.

    Returns
    -------
    py_wake.wind_farm_models.WindFarmModel
        Configured wake model ready for simulation.
    """
    from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
    from py_wake.superposition_models import LinearSum
    from py_wake.turbulence_models import STF2017TurbulenceModel
    from py_wake.wind_farm_models import All2AllIterative

    return All2AllIterative(
        site=site,
        windTurbines=turbine,
        wake_deficitModel=BastankhahGaussianDeficit(),
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
    )


def run_wake_analysis(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object,
    turbine: object | None = None,
) -> WakeAnalysisResult:
    """
    Run PyWake wake analysis and return structured results.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m]. Shape: (n_turbines,).
    y_positions_m : NDArray
        Turbine y-coordinates [m]. Shape: (n_turbines,).
    site : py_wake.site.BaseSite
        PyWake site object with wind resource data.
    turbine : py_wake.wind_turbines.WindTurbine, optional
        PyWake turbine object. If None, creates V236-15.0 MW.

    Returns
    -------
    WakeAnalysisResult
        Gross/net AEP, wake loss, per-turbine results, capacity factor.
    """
    if turbine is None:
        turbine = create_v236_wind_turbine()

    wf_model = configure_wake_model(site, turbine)

    # Run simulation
    sim_res = wf_model(
        x=x_positions_m,
        y=y_positions_m,
    )

    # Extract AEP results [GWh]
    # PyWake aep() returns values in GWh by default
    net_aep_per_turbine = sim_res.aep().values  # Shape: (n_turbines, ...)
    # Sum over wind directions and speeds to get per-turbine total
    per_turbine_net_gwh = net_aep_per_turbine.sum(axis=tuple(range(1, net_aep_per_turbine.ndim)))

    gross_aep_per_turbine = sim_res.aep(with_wake_loss=False).values
    per_turbine_gross_gwh = gross_aep_per_turbine.sum(
        axis=tuple(range(1, gross_aep_per_turbine.ndim))
    )

    total_net_gwh = float(per_turbine_net_gwh.sum())
    total_gross_gwh = float(per_turbine_gross_gwh.sum())

    # Wake loss
    wake_loss_pct = (1.0 - total_net_gwh / total_gross_gwh) * 100.0 if total_gross_gwh > 0 else 0.0

    # Per-turbine wake loss
    per_turbine_wake_loss = np.where(
        per_turbine_gross_gwh > 0,
        (1.0 - per_turbine_net_gwh / per_turbine_gross_gwh) * 100.0,
        0.0,
    )

    # Capacity factor: CF = net_AEP / (P_rated × 8760h × n_turbines)
    n_turbines = len(x_positions_m)
    theoretical_gwh = RATED_POWER_KW * 1e-6 * 8760.0 * n_turbines  # GWh
    capacity_factor = total_net_gwh / theoretical_gwh if theoretical_gwh > 0 else 0.0

    return WakeAnalysisResult(
        gross_aep_gwh=total_gross_gwh,
        net_aep_gwh=total_net_gwh,
        wake_loss_percent=wake_loss_pct,
        per_turbine_aep_gwh=per_turbine_net_gwh.astype(np.float64),
        per_turbine_wake_loss_percent=per_turbine_wake_loss.astype(np.float64),
        capacity_factor=capacity_factor,
    )
