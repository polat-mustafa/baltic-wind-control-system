"""
Wake modeling: reference turbine + PyWake BPA Gaussian wake analysis.

This module wraps PyWake to run wake-effect simulations for a wind farm
layout. The turbine comes from ``turbine_models`` (official IEA Wind Task 37
tables); SB-510 uses the IEA 15 MW turbine as a "V236-class" machine, since
Vestas publishes no V236 power or thrust curve.

Physics
-------
Wake effects reduce downstream wind speed. The Bastankhah-Porté-Agel (BPA)
Gaussian model assumes the velocity deficit follows a Gaussian profile that
expands linearly downstream. The Niayifar & Porté-Agel (2016) form used here
ties the expansion rate to the local turbulence intensity, so higher ambient
TI (and wake-added TI from STF2017) gives faster wake recovery. Wake
superposition uses linear summation.

Key equations:
- Wake deficit: ΔU/U₀ = (1 - √(1 - Ct/(8(σ/D)²)))
- Wake expansion: σ(x) = k*·x + ε·D, k* = 0.38·TI + 0.004, ε = 0.2·√β
- Linear superposition: total deficit = Σ individual deficits

Default turbine: IEA-15-240-RWT (tag v1.1.18)
---------------------------------------------
- Rotor diameter: 241.35 m (nominal 240 m), hub height 150 m
- Cut-in / rated / cut-out: 3 / 10.66 / 25 m/s
- Rated power: 15,000 kW

References
----------
- Bastankhah, M. & Porté-Agel, F. (2014). Renewable Energy 70, 116-123.
- Niayifar, A. & Porté-Agel, F. (2016). Energies 9(9), 741.
- Gaertner, E. et al. (2020). IEA 15 MW reference turbine. NREL/TP-5000-75698.
- IEC 61400-12-1: Power performance measurement
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.services.p1.turbine_models import DEFAULT_TURBINE_ID, get_turbine
from app.services.site_assessment.wind_climate import SB510_WEIBULL_A, SB510_WEIBULL_K

# ── Default turbine (SB-510, "V236 class") ─────────────────────────

_DEFAULT = get_turbine(DEFAULT_TURBINE_ID)
ROTOR_DIAMETER_M: float = _DEFAULT.rotor_diameter_m
HUB_HEIGHT_M: float = _DEFAULT.hub_height_m
RATED_POWER_KW: float = _DEFAULT.rated_kw
CUT_IN_SPEED_MS: float = _DEFAULT.cut_in_ms
RATED_SPEED_MS: float = _DEFAULT.rated_ms
CUT_OUT_SPEED_MS: float = _DEFAULT.cut_out_ms


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


def get_power_curve_kw(
    wind_speeds_ms: NDArray[np.floating],
    model_id: str | None = None,
) -> NDArray[np.floating]:
    """
    Power output [kW] of a turbine model (default SB-510's) at the given speeds.

    Rule 1 enforced: 0 ≤ P ≤ P_rated, zero below cut-in and above cut-out.

    Parameters
    ----------
    wind_speeds_ms : NDArray
        Hub-height wind speed values [m/s].
    model_id : str, optional
        Turbine model id (``turbine_models``); default IEA-15-240-RWT.

    Returns
    -------
    NDArray
        Power output [kW].
    """
    return get_turbine(model_id).power_curve_kw(wind_speeds_ms)


def get_ct_curve(
    wind_speeds_ms: NDArray[np.floating],
    model_id: str | None = None,
) -> NDArray[np.floating]:
    """
    Thrust coefficient [-] of a turbine model at the given speeds, in [0, 1].

    Parameters
    ----------
    wind_speeds_ms : NDArray
        Hub-height wind speed values [m/s].
    model_id : str, optional
        Turbine model id; default IEA-15-240-RWT.

    Returns
    -------
    NDArray
        Thrust coefficient [-], 0 outside the operating range.
    """
    return get_turbine(model_id).ct_curve(wind_speeds_ms)


# ── PyWake Integration Functions ───────────────────────────────────


def create_wind_turbine(model_id: str | None = None) -> Any:
    """
    PyWake WindTurbine for a turbine model (default SB-510's IEA 15 MW).

    Returns
    -------
    py_wake.wind_turbines.WindTurbine
        PyWake turbine object built from the tabulated power / Ct curve.
    """
    return get_turbine(model_id).pywake()


def rated_power_kw(turbine: Any) -> float:
    """Rated power [kW] of a PyWake turbine: the maximum of its power curve."""
    ws = np.linspace(0.0, 40.0, 401)
    return float(np.max(turbine.power(ws))) / 1e3


def create_uniform_site(
    weibull_a_ms: float = SB510_WEIBULL_A,
    weibull_k: float = SB510_WEIBULL_K,
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

    Uses the Gaussian deficit with TI-dependent expansion (Niayifar &
    Porté-Agel 2016, PyWake NiayifarGaussianDeficit) with:
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
    from py_wake.deficit_models.gaussian import NiayifarGaussianDeficit
    from py_wake.superposition_models import LinearSum
    from py_wake.turbulence_models import STF2017TurbulenceModel
    from py_wake.wind_farm_models import All2AllIterative

    return All2AllIterative(
        site=site,
        windTurbines=turbine,
        wake_deficitModel=NiayifarGaussianDeficit(),
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
        PyWake turbine object. If None, the SB-510 default (IEA 15 MW).

    Returns
    -------
    WakeAnalysisResult
        Gross/net AEP, wake loss, per-turbine results, capacity factor.
    """
    if turbine is None:
        turbine = create_wind_turbine()

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

    # Capacity factor: CF = net_AEP / (P_rated × 8760h × n_turbines), with the rating of
    # the turbine actually simulated (not a fixed constant).
    n_turbines = len(x_positions_m)
    theoretical_gwh = rated_power_kw(turbine) * 1e-6 * 8760.0 * n_turbines  # GWh
    capacity_factor = total_net_gwh / theoretical_gwh if theoretical_gwh > 0 else 0.0

    return WakeAnalysisResult(
        gross_aep_gwh=total_gross_gwh,
        net_aep_gwh=total_net_gwh,
        wake_loss_percent=wake_loss_pct,
        per_turbine_aep_gwh=per_turbine_net_gwh.astype(np.float64),
        per_turbine_wake_loss_percent=per_turbine_wake_loss.astype(np.float64),
        capacity_factor=capacity_factor,
    )


#: Cluster-wake grid: 5° directions and 2 m/s speeds — hundreds of neighbour turbines make
#: the 1° default too heavy (≈ 1 min and 0.6 GB for 680 turbines at 5° × 1 m/s).
CLUSTER_WD = np.arange(0.0, 360.0, 5.0)
CLUSTER_WS = np.arange(3.0, 26.0, 2.0)


def _overlap_avg_model() -> Any:
    """PyWake's GaussianOverlapAvgModel with its own shipped table, read through
    h5netcdf's pure-Python ``pyfive`` backend. PyWake opens it with h5py, whose compiled
    HDF5 library is not a dependency here (and Windows application control blocks its
    DLLs); the table, its spline and the grid interpolation are PyWake's, unchanged."""
    import h5netcdf  # type: ignore[import-untyped]
    from py_wake.rotor_avg_models.gaussian_overlap_model import GaussianOverlapAvgModel
    from py_wake.utils.grid_interpolator import GridInterpolator
    from scipy.interpolate import RectBivariateSpline

    class OverlapAvg(GaussianOverlapAvgModel):  # type: ignore[misc]
        @property
        def overlap_interpolator(self) -> Any:
            if not hasattr(self, "_overlap_interpolator"):
                with h5netcdf.File(self.filename, "r", backend="pyfive") as f:
                    r_tab = np.asarray(f.variables["R_sigma"][...])
                    cw_tab = np.asarray(f.variables["CW_sigma"][...])
                    table = np.asarray(f.variables["__xarray_dataarray_variable__"][...])
                r_sigma = np.arange(0, 20.001, 0.01)
                cw_sigma = np.arange(0, 10.01, 0.01)
                dat = RectBivariateSpline(r_tab, cw_tab, table)(r_sigma, cw_sigma)
                self._overlap_interpolator = GridInterpolator(
                    [r_sigma, cw_sigma], dat, bounds="limit"
                )
            return self._overlap_interpolator

    return OverlapAvg()


def run_cluster_wake(
    x_m: NDArray[np.floating],
    y_m: NDArray[np.floating],
    neighbour_x_m: NDArray[np.floating],
    neighbour_y_m: NDArray[np.floating],
    site: Any,
    turbine: Any,
) -> dict[str, float]:
    """Net AEP of the own turbines alone and with the neighbouring farms [GWh/yr].

    Wakes between farms decay more slowly than the Gaussian models used inside a
    farm assume, so both runs use TurbOPark (Nygaard et al. 2022, Ørsted's
    turbulence-optimised Park model, validated on cluster wakes) as PyWake's
    ``Nygaard_2022`` sets it up — TurboGaussianDeficit with ct2a_mom1d, mirrored
    ground, ctlim 0.96, deficit scaled with the downstream turbine's ambient
    wind, squared-sum superposition, Gaussian-overlap rotor average (PyWake's
    table, ``_overlap_avg_model``). Same direction / speed grid for both runs;
    their ratio is the external wake loss.
    """
    from py_wake.literature.turbopark import (
        Mirror,
        PropagateDownwind,
        SquaredSum,
        TurboGaussianDeficit,
        ct2a_mom1d,
    )

    deficit = TurboGaussianDeficit(
        ct2a=ct2a_mom1d,
        groundModel=Mirror(superpositionModel=SquaredSum()),
        rotorAvgModel=_overlap_avg_model(),
        ctlim=0.96,
    )
    deficit.WS_key = "WS_jlk"
    model = PropagateDownwind(
        site, turbine, wake_deficitModel=deficit, superpositionModel=SquaredSum()
    )
    n = len(x_m)

    def own_net(x: NDArray[np.floating], y: NDArray[np.floating]) -> float:
        res = model(x, y, wd=CLUSTER_WD, ws=CLUSTER_WS, wd_chunks=12)
        return float(res.aep().sum(["wd", "ws"]).values[:n].sum())

    alone = own_net(np.asarray(x_m), np.asarray(y_m))
    together = own_net(
        np.concatenate([np.asarray(x_m), np.asarray(neighbour_x_m)]),
        np.concatenate([np.asarray(y_m), np.asarray(neighbour_y_m)]),
    )
    return {
        "alone_gwh": alone,
        "with_neighbours_gwh": together,
        "external_wake_loss_percent": 100.0 * (1.0 - together / alone) if alone > 0 else 0.0,
    }
