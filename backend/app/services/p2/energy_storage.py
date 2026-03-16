"""
Battery Energy Storage System (BESS) modeling for wind farm integration.

Physics — Battery Storage
--------------------------
A BESS coupled with a wind farm provides:
1. **Energy arbitrage**: Store excess wind during low-price hours, discharge
   during high-price hours.
2. **Curtailment reduction**: Absorb power that would otherwise be curtailed
   due to grid constraints.
3. **Ramp rate smoothing**: Buffer fast wind ramps to comply with grid code
   ramp limits (PSE: 10% Pn/min up, 20% Pn/min down).
4. **Frequency regulation**: Fast power injection/absorption for grid stability.

Battery Model (Li-ion NMC/LFP)
-------------------------------
State of Charge dynamics:
    SoC(t+1) = SoC(t) + (η_charge × P_charge - P_discharge / η_discharge) × Δt / E_rated

Constraints:
    SoC_min ≤ SoC(t) ≤ SoC_max        [depth of discharge limits]
    |P(t)| ≤ P_rated                   [power rating]
    SoC(0) = SoC(T)                    [daily cycle return to initial SoC]

Typical Parameters (utility-scale BESS):
    Roundtrip efficiency: 85-92% (Li-ion)
    Depth of discharge: 10-90% (for longevity)
    C-rate: 0.5-2C (1C = discharge full capacity in 1 hour)
    Degradation: ~2-3% per year (calendar + cycling)

References
----------
- Mongird, K. et al. (2020). Grid-scale energy storage technology cost
  and performance review. PNNL-28866.
- ENTSO-E: Storage in ancillary services
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

# ── BESS Constants ──────────────────────────────────────────────

DEFAULT_BESS_POWER_MW: float = 100.0
"""Default BESS power rating [MW]."""

DEFAULT_BESS_ENERGY_MWH: float = 400.0
"""Default BESS energy capacity [MWh] (4-hour duration)."""

DEFAULT_EFFICIENCY: float = 0.90
"""Roundtrip efficiency [-] (Li-ion NMC)."""

SOC_MIN: float = 0.10
"""Minimum state of charge [-]."""

SOC_MAX: float = 0.90
"""Maximum state of charge [-]."""


@dataclass(frozen=True)
class BESSTimestep:
    """BESS operation at a single timestep.

    Attributes
    ----------
    hour : int
        Hour of day [0-23].
    wind_power_mw : float
        Available wind power [MW].
    bess_power_mw : float
        BESS power [MW]. Positive = discharging, negative = charging.
    grid_export_mw : float
        Power exported to grid [MW].
    soc : float
        State of charge after this timestep [-].
    curtailed_mw : float
        Wind power curtailed [MW].
    revenue_eur : float
        Revenue from grid export at this timestep [EUR].
    """

    hour: int
    wind_power_mw: float
    bess_power_mw: float
    grid_export_mw: float
    soc: float
    curtailed_mw: float
    revenue_eur: float


@dataclass(frozen=True)
class BESSResult:
    """Result of BESS dispatch optimization.

    Attributes
    ----------
    total_revenue_eur : float
        Total daily revenue [EUR].
    revenue_without_bess_eur : float
        Revenue without BESS (direct export) [EUR].
    revenue_gain_eur : float
        Additional revenue from BESS [EUR].
    revenue_gain_percent : float
        Revenue improvement from BESS [%].
    curtailment_without_bess_mwh : float
        Energy curtailed without BESS [MWh].
    curtailment_with_bess_mwh : float
        Energy curtailed with BESS [MWh].
    curtailment_reduction_mwh : float
        Curtailment reduction from BESS [MWh].
    bess_cycles : float
        Equivalent full cycles used per day [-].
    average_soc : float
        Average state of charge [-].
    bess_power_mw : float
        BESS power rating [MW].
    bess_energy_mwh : float
        BESS energy capacity [MWh].
    timesteps : list[BESSTimestep]
        Per-timestep operation details.
    """

    total_revenue_eur: float
    revenue_without_bess_eur: float
    revenue_gain_eur: float
    revenue_gain_percent: float
    curtailment_without_bess_mwh: float
    curtailment_with_bess_mwh: float
    curtailment_reduction_mwh: float
    bess_cycles: float
    average_soc: float
    bess_power_mw: float
    bess_energy_mwh: float
    timesteps: list[BESSTimestep] = field(default_factory=list)


def run_bess_dispatch(
    wind_power_mw: NDArray[np.floating],
    electricity_prices_eur_mwh: NDArray[np.floating] | None = None,
    grid_export_limit_mw: float = 510.0,
    bess_power_mw: float = DEFAULT_BESS_POWER_MW,
    bess_energy_mwh: float = DEFAULT_BESS_ENERGY_MWH,
    efficiency: float = DEFAULT_EFFICIENCY,
    initial_soc: float = 0.50,
) -> BESSResult:
    """Run BESS dispatch optimization over a 24-hour period.

    Uses a simple rule-based strategy:
    - Charge when electricity price is below median AND excess wind available
    - Discharge when price is above median AND grid can accept power
    - Absorb curtailment whenever possible

    Parameters
    ----------
    wind_power_mw : NDArray
        24-hour wind power profile [MW].
    electricity_prices_eur_mwh : NDArray, optional
        24-hour electricity prices [EUR/MWh]. Default: synthetic profile.
    grid_export_limit_mw : float
        Maximum grid export [MW]. Default: 510.0.
    bess_power_mw : float
        BESS power rating [MW]. Default: 100.
    bess_energy_mwh : float
        BESS energy capacity [MWh]. Default: 400.
    efficiency : float
        Roundtrip efficiency [-]. Default: 0.90.
    initial_soc : float
        Initial state of charge [-]. Default: 0.50.

    Returns
    -------
    BESSResult
        Dispatch results with revenue analysis.
    """
    if electricity_prices_eur_mwh is None:
        # Synthetic Polish day-ahead prices (higher afternoon, lower night)
        hours = np.arange(24)
        base_price = 72.0
        diurnal = base_price * (1.0 + 0.3 * np.sin(np.pi * (hours - 6) / 12.0))
        electricity_prices_eur_mwh = np.clip(diurnal, 30.0, 120.0)

    eta_charge = np.sqrt(efficiency)  # Split roundtrip efficiency
    eta_discharge = np.sqrt(efficiency)
    median_price = float(np.median(electricity_prices_eur_mwh))

    soc = initial_soc
    timesteps: list[BESSTimestep] = []
    total_revenue = 0.0
    total_revenue_no_bess = 0.0
    total_curtail_no_bess = 0.0
    total_curtail_with_bess = 0.0
    total_charge_energy = 0.0
    total_discharge_energy = 0.0
    soc_sum = 0.0

    for h in range(24):
        wind = float(wind_power_mw[h])
        price = float(electricity_prices_eur_mwh[h])

        # Without BESS: direct export, curtail if over limit
        direct_export = min(wind, grid_export_limit_mw)
        curtail_no_bess = wind - direct_export
        total_curtail_no_bess += curtail_no_bess
        total_revenue_no_bess += direct_export * price

        # With BESS: charge/discharge strategy
        bess_power = 0.0
        excess = wind - grid_export_limit_mw  # Positive = excess to absorb

        if excess > 0:
            # Excess wind: charge BESS
            charge_room = (SOC_MAX - soc) * bess_energy_mwh  # MWh available to charge
            max_charge_mw = min(bess_power_mw, excess, charge_room / 1.0)  # 1h timestep
            bess_power = -max_charge_mw  # Negative = charging
            soc += max_charge_mw * eta_charge / bess_energy_mwh
            total_charge_energy += max_charge_mw

        elif price > median_price * 1.1 and soc > SOC_MIN + 0.05:
            # High price: discharge
            discharge_room = (soc - SOC_MIN) * bess_energy_mwh
            max_discharge_mw = min(
                bess_power_mw,
                discharge_room / 1.0,
                grid_export_limit_mw - wind,  # Don't exceed grid limit
            )
            max_discharge_mw = max(0.0, max_discharge_mw)
            bess_power = max_discharge_mw  # Positive = discharging
            soc -= max_discharge_mw / (eta_discharge * bess_energy_mwh)
            total_discharge_energy += max_discharge_mw

        elif (
            price < median_price * 0.9
            and soc < SOC_MAX - 0.05
            and wind < grid_export_limit_mw * 0.7
        ):
            # Low price, low wind: charge from grid (arbitrage)
            charge_room = (SOC_MAX - soc) * bess_energy_mwh
            max_charge_mw = min(bess_power_mw, charge_room / 1.0)
            bess_power = -max_charge_mw
            soc += max_charge_mw * eta_charge / bess_energy_mwh
            total_charge_energy += max_charge_mw

        soc = np.clip(soc, SOC_MIN, SOC_MAX)

        # Grid export with BESS
        grid_export = min(wind + max(0, bess_power), grid_export_limit_mw)
        if bess_power < 0:  # Charging
            grid_export = min(wind + bess_power, grid_export_limit_mw)  # wind minus charge
            grid_export = max(0.0, grid_export)

        curtailed = wind - grid_export - max(0, -bess_power)
        curtailed = max(0.0, curtailed)
        total_curtail_with_bess += curtailed

        revenue = grid_export * price
        # Charging cost (if from grid)
        if bess_power < 0 and wind < grid_export_limit_mw:
            charge_from_grid = min(-bess_power, grid_export_limit_mw - wind)
            revenue -= charge_from_grid * price

        total_revenue += revenue
        soc_sum += soc

        timesteps.append(
            BESSTimestep(
                hour=h,
                wind_power_mw=round(wind, 1),
                bess_power_mw=round(bess_power, 1),
                grid_export_mw=round(grid_export, 1),
                soc=round(float(soc), 3),
                curtailed_mw=round(curtailed, 1),
                revenue_eur=round(revenue, 2),
            )
        )

    # Equivalent cycles
    total_energy_throughput = (total_charge_energy + total_discharge_energy) / 2.0
    cycles = total_energy_throughput / bess_energy_mwh if bess_energy_mwh > 0 else 0.0

    revenue_gain = total_revenue - total_revenue_no_bess
    revenue_gain_pct = (
        revenue_gain / total_revenue_no_bess * 100.0 if total_revenue_no_bess > 0 else 0.0
    )

    return BESSResult(
        total_revenue_eur=round(total_revenue, 2),
        revenue_without_bess_eur=round(total_revenue_no_bess, 2),
        revenue_gain_eur=round(revenue_gain, 2),
        revenue_gain_percent=round(revenue_gain_pct, 2),
        curtailment_without_bess_mwh=round(total_curtail_no_bess, 1),
        curtailment_with_bess_mwh=round(total_curtail_with_bess, 1),
        curtailment_reduction_mwh=round(total_curtail_no_bess - total_curtail_with_bess, 1),
        bess_cycles=round(cycles, 2),
        average_soc=round(soc_sum / 24.0, 3),
        bess_power_mw=bess_power_mw,
        bess_energy_mwh=bess_energy_mwh,
        timesteps=timesteps,
    )
