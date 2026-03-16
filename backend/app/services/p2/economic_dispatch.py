"""
Economic dispatch and unit commitment for wind farm + grid.

Physics — Economic Dispatch
-----------------------------
Economic dispatch determines the optimal power output of each generating
unit to meet demand at minimum cost, subject to operational constraints.

For a wind farm connected to a grid, the dispatch problem is:
    min  Σ c_i × P_i + c_curtail × P_curtailed
    s.t. Σ P_i = P_demand + P_losses
         P_min_i ≤ P_i ≤ P_max_i
         Ramp rate: |P_i(t) - P_i(t-1)| ≤ ΔP_max_i

Cost Model (Baltic Wind Alpha)
-------------------------------
- Wind marginal cost: 0 EUR/MWh (fuel-free)
- Balancing cost: 20 EUR/MWh (deviation from forecast)
- Curtailment penalty: 72 EUR/MWh (lost CfD revenue)
- Grid import: 72 EUR/MWh (spot market price)
- Ramp violation: 50 EUR/MWh (grid code penalty)

Time-Series Dispatch
---------------------
Given a 24-hour wind forecast, the dispatcher:
1. Computes available power per timestep from wind forecast
2. Applies ramp rate limits (PSE: 10% Pn/min up, 20% Pn/min down)
3. Accounts for curtailment orders from TSO
4. Optimizes between generating, curtailing, and importing

References
----------
- Wood, A.J. & Wollenberg, B.F. (2013). Power Generation, Operation, and
  Control. Wiley.
- PSE IRiESP: Ramp rate requirements for wind farms
- ENTSO-E: Balancing market rules
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p2.network_model import (
    TOTAL_CAPACITY_MW,
)

# ── Economic Dispatch Constants ─────────────────────────────────

WIND_MARGINAL_COST: float = 0.0  # EUR/MWh
BALANCING_COST: float = 20.0  # EUR/MWh
CURTAILMENT_PENALTY: float = 72.0  # EUR/MWh
GRID_IMPORT_COST: float = 72.0  # EUR/MWh
RAMP_UP_LIMIT_PERCENT_MIN: float = 10.0  # 10% Pn/min (PSE IRiESP)
RAMP_DOWN_LIMIT_PERCENT_MIN: float = 20.0  # 20% Pn/min (PSE IRiESP)


@dataclass(frozen=True)
class DispatchTimestep:
    """Dispatch result for a single timestep.

    Attributes
    ----------
    hour : int
        Hour of day [0-23].
    wind_power_available_mw : float
        Available wind power [MW].
    wind_power_dispatched_mw : float
        Dispatched wind power [MW].
    curtailed_mw : float
        Curtailed power [MW].
    grid_import_mw : float
        Imported from grid [MW] (to cover demand if needed).
    ramp_rate_mw_min : float
        Actual ramp rate [MW/min]. Positive = up.
    ramp_compliant : bool
        Whether ramp rate is within PSE limits.
    cost_eur : float
        Total cost for this hour [EUR].
    """

    hour: int
    wind_power_available_mw: float
    wind_power_dispatched_mw: float
    curtailed_mw: float
    grid_import_mw: float
    ramp_rate_mw_min: float
    ramp_compliant: bool
    cost_eur: float


@dataclass(frozen=True)
class EconomicDispatchResult:
    """Result of 24-hour economic dispatch.

    Attributes
    ----------
    total_generation_mwh : float
        Total wind energy generated [MWh].
    total_curtailment_mwh : float
        Total curtailed energy [MWh].
    total_import_mwh : float
        Total grid import [MWh].
    total_cost_eur : float
        Total operating cost [EUR/day].
    curtailment_cost_eur : float
        Cost of curtailment [EUR/day].
    average_cost_eur_mwh : float
        Average cost per MWh dispatched [EUR/MWh].
    max_ramp_mw_min : float
        Maximum observed ramp rate [MW/min].
    ramp_violations : int
        Number of timesteps with ramp rate violations.
    capacity_factor : float
        Achieved capacity factor over dispatch period [-].
    timesteps : list[DispatchTimestep]
        Per-timestep dispatch results.
    """

    total_generation_mwh: float
    total_curtailment_mwh: float
    total_import_mwh: float
    total_cost_eur: float
    curtailment_cost_eur: float
    average_cost_eur_mwh: float
    max_ramp_mw_min: float
    ramp_violations: int
    capacity_factor: float
    timesteps: list[DispatchTimestep] = field(default_factory=list)


def generate_wind_forecast(
    mean_speed_ms: float = 10.5,
    variability: float = 0.3,
    seed: int = 42,
) -> NDArray[np.floating]:
    """Generate a synthetic 24-hour wind power forecast.

    Creates a realistic diurnal wind profile with random variation.

    Parameters
    ----------
    mean_speed_ms : float
        Mean wind speed [m/s]. Default: 10.5.
    variability : float
        Relative variability of wind power [0-1]. Default: 0.3.
    seed : int
        Random seed. Default: 42.

    Returns
    -------
    NDArray
        Available power per hour [MW]. Shape: (24,).
    """
    rng = np.random.default_rng(seed)
    hours = np.arange(24)

    # Base wind profile: stronger at night, lighter midday (typical Baltic)
    diurnal = 1.0 + 0.1 * np.cos(2 * np.pi * (hours - 4) / 24.0)

    # Random perturbations
    noise = 1.0 + variability * rng.standard_normal(24)
    noise = np.clip(noise, 0.3, 1.5)

    # Convert to power fraction using cubic relationship
    # P ∝ v³, normalised to capacity
    speed_profile = mean_speed_ms * diurnal * noise
    # Simple power curve approximation
    power_fraction = np.clip((speed_profile / 12.5) ** 3, 0.0, 1.0)

    available_mw = power_fraction * TOTAL_CAPACITY_MW
    result: NDArray[np.floating] = np.round(available_mw, 1).astype(np.float64)
    return result


def run_economic_dispatch(
    wind_forecast_mw: NDArray[np.floating] | None = None,
    demand_mw: float | None = None,
    curtailment_order_mw: float = 0.0,
    electricity_price_eur_mwh: float = 72.0,
) -> EconomicDispatchResult:
    """Run 24-hour economic dispatch for the wind farm.

    Parameters
    ----------
    wind_forecast_mw : NDArray, optional
        24-hour wind power forecast [MW]. Default: synthetic forecast.
    demand_mw : float, optional
        Constant demand to serve [MW]. Default: None (export all).
    curtailment_order_mw : float
        TSO curtailment order [MW] — max power to generate. Default: 0 (no limit).
    electricity_price_eur_mwh : float
        Electricity price [EUR/MWh]. Default: 72.0.

    Returns
    -------
    EconomicDispatchResult
        24-hour dispatch results with costs and ramp compliance.
    """
    if wind_forecast_mw is None:
        wind_forecast_mw = generate_wind_forecast()

    # Ramp limits in MW/min
    ramp_up_limit = RAMP_UP_LIMIT_PERCENT_MIN / 100.0 * TOTAL_CAPACITY_MW  # 51 MW/min
    ramp_down_limit = RAMP_DOWN_LIMIT_PERCENT_MIN / 100.0 * TOTAL_CAPACITY_MW  # 102 MW/min

    # Maximum generation cap from TSO
    max_gen = TOTAL_CAPACITY_MW if curtailment_order_mw <= 0 else curtailment_order_mw

    timesteps: list[DispatchTimestep] = []
    prev_dispatch = 0.0
    total_gen = 0.0
    total_curtail = 0.0
    total_import = 0.0
    total_cost = 0.0
    curtail_cost = 0.0
    max_ramp = 0.0
    ramp_violations = 0

    for h in range(24):
        available = float(wind_forecast_mw[h])

        # Target dispatch: minimum of available and TSO cap
        target = min(available, max_gen)

        # Apply ramp rate limits (per hour = per minute × 60)
        if h > 0:
            max_up = prev_dispatch + ramp_up_limit * 60.0
            max_down = prev_dispatch - ramp_down_limit * 60.0
            dispatched = np.clip(target, max(0.0, max_down), max_up)
        else:
            dispatched = target

        curtailed = available - dispatched
        import_mw = max(0.0, (demand_mw or 0.0) - dispatched)

        # Ramp rate (MW/min, assuming 1-hour timestep → ramp over 60 min)
        ramp_mw_min = (dispatched - prev_dispatch) / 60.0 if h > 0 else 0.0
        ramp_compliant = True
        if h > 0 and (
            (ramp_mw_min > 0 and ramp_mw_min > ramp_up_limit * 1.01)
            or (ramp_mw_min < 0 and abs(ramp_mw_min) > ramp_down_limit * 1.01)
        ):
            ramp_compliant = False
            ramp_violations += 1

        # Costs
        gen_cost = dispatched * WIND_MARGINAL_COST  # 0 for wind
        curtail_penalty = curtailed * CURTAILMENT_PENALTY
        import_cost = import_mw * GRID_IMPORT_COST
        hour_cost = gen_cost + curtail_penalty + import_cost

        timesteps.append(
            DispatchTimestep(
                hour=h,
                wind_power_available_mw=round(available, 1),
                wind_power_dispatched_mw=round(dispatched, 1),
                curtailed_mw=round(curtailed, 1),
                grid_import_mw=round(import_mw, 1),
                ramp_rate_mw_min=round(ramp_mw_min, 2),
                ramp_compliant=ramp_compliant,
                cost_eur=round(hour_cost, 2),
            )
        )

        total_gen += dispatched
        total_curtail += curtailed
        total_import += import_mw
        total_cost += hour_cost
        curtail_cost += curtail_penalty
        max_ramp = max(max_ramp, abs(ramp_mw_min))
        prev_dispatch = dispatched

    avg_cost = total_cost / total_gen if total_gen > 0 else 0.0
    cf = total_gen / (TOTAL_CAPACITY_MW * 24.0) if TOTAL_CAPACITY_MW > 0 else 0.0

    return EconomicDispatchResult(
        total_generation_mwh=round(total_gen, 1),
        total_curtailment_mwh=round(total_curtail, 1),
        total_import_mwh=round(total_import, 1),
        total_cost_eur=round(total_cost, 2),
        curtailment_cost_eur=round(curtail_cost, 2),
        average_cost_eur_mwh=round(avg_cost, 2),
        max_ramp_mw_min=round(max_ramp, 2),
        ramp_violations=ramp_violations,
        capacity_factor=round(cf, 4),
        timesteps=timesteps,
    )
