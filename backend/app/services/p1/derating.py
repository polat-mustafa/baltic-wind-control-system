"""
Derating (axial-induction control) for wake mitigation.

Physics
-------
Derating lowers the power setpoint of the front-row turbines. Pitching to a
lower power also lowers the axial induction a and hence the thrust Ct, so
the wake behind them is weaker and downstream turbines see more wind.

Actuator-disk theory links the two (per unit rotor area and wind speed):
    Cp = 4a(1 − a)²,   Ct = 4a(1 − a)
A setpoint α·P_available therefore needs the induction a that solves
    a(1 − a)² = α · a₀(1 − a₀)²,   a₀ = ½(1 − √(1 − Ct₀))
and gives the derated thrust Ct = 4a(1 − a).

The derated front row is modelled in PyWake as a second turbine type
(power α·P(v), thrust from the mapping above); the farm is evaluated for one
wind direction, Weibull-averaged over wind speed.

What to expect: with engineering wake models the downstream gain rarely
beats the upstream loss — field tests (van der Hoek et al. 2019) and model
studies (Annoni et al. 2018) find little or no net benefit. An optimum at
α = 1 (no derating) is a legitimate, physically meaningful answer.

References
----------
- van der Hoek, D. et al. (2019). Effects of axial induction control on wind
  farm energy production — a field experiment. Renewable Energy 140, 994–1003.
- Annoni, J. et al. (2018). Analysis of axial-induction-based wind plant
  control using an engineering and a high-order wind plant model.
  Wind Energy 19(6), 1135–1150.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize_scalar

from app.services.p1.wake_model import (
    HUB_HEIGHT_M,
    ROTOR_DIAMETER_M,
    create_uniform_site,
    create_wind_turbine,
    get_ct_curve,
    get_power_curve_kw,
)


@dataclass(frozen=True)
class DeratingResult:
    """Result of derating analysis for a wind farm.

    Attributes
    ----------
    baseline_power_mw : float
        Total farm power without derating [MW].
    derated_power_mw : float
        Total farm power with optimal derating [MW].
    power_gain_percent : float
        Net power gain from derating [%]. Can be negative if derating
        reduces upstream power more than it recovers downstream.
    optimal_derating_fraction : float
        Optimal derating fraction α [-], 0 < α ≤ 1.
    per_turbine_baseline_mw : NDArray
        Per-turbine power without derating [MW].
    per_turbine_derated_mw : NDArray
        Per-turbine power with derating [MW].
    upstream_loss_mw : float
        Power lost from derating upstream turbines [MW].
    downstream_gain_mw : float
        Power gained by downstream turbines from reduced wakes [MW].
    """

    baseline_power_mw: float
    derated_power_mw: float
    power_gain_percent: float
    optimal_derating_fraction: float
    per_turbine_baseline_mw: NDArray[np.floating]
    per_turbine_derated_mw: NDArray[np.floating]
    upstream_loss_mw: float
    downstream_gain_mw: float


def derated_ct(ct: NDArray[np.floating], alpha: float) -> NDArray[np.floating]:
    """Thrust coefficient after derating to α·P (actuator-disk mapping, see module doc)."""
    a0 = np.minimum(0.5 * (1.0 - np.sqrt(1.0 - np.clip(ct, 0.0, 8.0 / 9.0))), 1.0 / 3.0)
    target = alpha * a0 * (1.0 - a0) ** 2
    lo, hi = np.zeros_like(a0), a0.copy()  # a(1−a)² is increasing on [0, 1/3]
    for _ in range(50):
        mid = (lo + hi) / 2.0
        below = mid * (1.0 - mid) ** 2 < target
        lo, hi = np.where(below, mid, lo), np.where(below, hi, mid)
    a = (lo + hi) / 2.0
    return np.asarray(4.0 * a * (1.0 - a), dtype=np.float64)


def _front_row(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_direction_deg: float,
) -> NDArray[np.bool_]:
    """Upstream half: largest projection on the unit vector pointing INTO the wind."""
    rad = np.radians(wind_direction_deg)
    toward_wind = x_positions_m * np.sin(rad) + y_positions_m * np.cos(rad)
    return np.asarray(toward_wind > np.median(toward_wind))


def compute_derated_power(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object,
    derating_fraction: float,
    wind_direction_deg: float = 240.0,
    weibull_a_ms: float = 10.5,
    weibull_k: float = 2.2,
) -> tuple[float, NDArray[np.floating]]:
    """Weibull-averaged farm power [MW] for one wind direction, front row derated.

    Returns (total_power_mw, per_turbine_power_mw).
    """
    from py_wake.deficit_models.gaussian import NiayifarGaussianDeficit
    from py_wake.superposition_models import LinearSum
    from py_wake.turbulence_models import STF2017TurbulenceModel
    from py_wake.wind_farm_models import PropagateDownwind
    from py_wake.wind_turbines import WindTurbine, WindTurbines
    from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

    ws = np.arange(3.0, 26.0, 0.5)
    ct = get_ct_curve(ws)
    full = create_wind_turbine()
    derated = WindTurbine(
        name="IEA-15 derated",
        diameter=ROTOR_DIAMETER_M,
        hub_height=HUB_HEIGHT_M,
        powerCtFunction=PowerCtTabular(
            ws=ws,
            power=derating_fraction * get_power_curve_kw(ws) * 1e3,
            power_unit="W",
            ct=derated_ct(ct, derating_fraction),
        ),
    )
    model = PropagateDownwind(
        site,
        WindTurbines.from_WindTurbine_lst([full, derated]),
        wake_deficitModel=NiayifarGaussianDeficit(),
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
    )
    types = _front_row(x_positions_m, y_positions_m, wind_direction_deg).astype(int)
    sim = model(x_positions_m, y_positions_m, type=types, wd=[wind_direction_deg], ws=ws)
    power_mw = np.asarray(sim.Power.values)[:, 0, :] / 1e6  # (n_wt, n_ws)

    # Weibull weights for the speed bins
    edges = np.concatenate([[ws[0] - 0.25], ws + 0.25])
    cdf = 1.0 - np.exp(-((edges / weibull_a_ms) ** weibull_k))
    w = np.diff(cdf) / np.diff(cdf).sum()
    per_turbine = power_mw @ w
    return float(per_turbine.sum()), per_turbine.astype(np.float64)


def optimize_derating(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object | None = None,
    wind_direction_deg: float = 240.0,
    weibull_a_ms: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
) -> DeratingResult:
    """Find the front-row setpoint α ∈ [0.5, 1] that maximises farm power.

    The bounded search can stop just inside the bound, so α = 1 (no
    derating) is always compared explicitly — the optimum is never worse
    than the baseline.
    """
    if site is None:
        site = create_uniform_site(weibull_a_ms, weibull_k, turbulence_intensity)

    def farm(alpha: float) -> tuple[float, NDArray[np.floating]]:
        return compute_derated_power(
            x_positions_m, y_positions_m, site, alpha, wind_direction_deg, weibull_a_ms, weibull_k
        )

    baseline_mw, baseline_per_turbine = farm(1.0)
    search = minimize_scalar(
        lambda a: -farm(a)[0], bounds=(0.5, 1.0), method="bounded", options={"xatol": 0.005}
    )
    candidate = float(search.x)
    candidate_mw, candidate_per_turbine = farm(candidate)
    if candidate_mw > baseline_mw:
        alpha, derated_mw, derated_per_turbine = candidate, candidate_mw, candidate_per_turbine
    else:
        alpha, derated_mw, derated_per_turbine = 1.0, baseline_mw, baseline_per_turbine

    delta = derated_per_turbine - baseline_per_turbine
    return DeratingResult(
        baseline_power_mw=round(baseline_mw, 3),
        derated_power_mw=round(derated_mw, 3),
        power_gain_percent=round((derated_mw - baseline_mw) / baseline_mw * 100.0, 2),
        optimal_derating_fraction=round(alpha, 3),
        per_turbine_baseline_mw=np.round(baseline_per_turbine, 3),
        per_turbine_derated_mw=np.round(derated_per_turbine, 3),
        upstream_loss_mw=round(float(-delta[delta < 0].sum()), 3),
        downstream_gain_mw=round(float(delta[delta > 0].sum()), 3),
    )
