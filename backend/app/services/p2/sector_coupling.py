"""
Sector coupling — electricity + heat + hydrogen integration modeling.

Physics
-------
Sector coupling links the electricity sector with heat and hydrogen
production, enabling higher renewable utilization by converting surplus
power to other energy carriers:

1. **Power-to-Heat (P2H)**: Electric boilers or heat pumps convert
   surplus electricity to district heating. COP of heat pumps: 2.5-4.0.

2. **Power-to-Hydrogen (P2H2)**: Electrolyzers convert surplus
   electricity to hydrogen. Efficiency: 60-70% (PEM), 70-80% (alkaline).

3. **Combined Heat and Power (CHP)**: Gas turbines produce both
   electricity and heat. Overall efficiency: 80-90%.

4. **Hydrogen-to-Power (H2P)**: Fuel cells or H2-ready gas turbines
   convert hydrogen back to electricity. Efficiency: 40-60%.

The coupling enables temporal flexibility: produce hydrogen when wind
is abundant and electricity prices are low, use hydrogen for power/heat
when wind is scarce and prices are high.

References
----------
- Brown, T. et al. (2018). Synergies of sector coupling and transmission
  reinforcement in a cost-optimised European energy system. Energy, 160.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

# ── Sector Coupling Constants ──────────────────────────────────

HEAT_PUMP_COP: float = 3.5
"""Heat pump coefficient of performance [-]."""

ELECTRIC_BOILER_EFFICIENCY: float = 0.98
"""Electric boiler efficiency [-]."""

ELECTROLYZER_EFFICIENCY: float = 0.65
"""PEM electrolyzer efficiency (electricity → hydrogen LHV) [-]."""

FUEL_CELL_EFFICIENCY: float = 0.50
"""Fuel cell efficiency (hydrogen LHV → electricity) [-]."""

CHP_ELECTRICAL_EFFICIENCY: float = 0.40
"""CHP gas turbine electrical efficiency [-]."""

CHP_THERMAL_EFFICIENCY: float = 0.45
"""CHP gas turbine thermal efficiency [-]."""

HYDROGEN_LHV_MWH_PER_KG: float = 0.0333
"""Lower heating value of hydrogen [MWh/kg]."""

H2_STORAGE_CAPACITY_KG: float = 50000.0
"""Default hydrogen storage capacity [kg]."""


@dataclass(frozen=True)
class SectorCouplingResult:
    """Result of sector coupling analysis.

    Attributes
    ----------
    total_electricity_gen_mwh : float
        Total wind electricity generated [MWh].
    electricity_to_grid_mwh : float
        Electricity delivered to grid [MWh].
    electricity_to_heat_mwh : float
        Electricity used for heat production [MWh].
    electricity_to_hydrogen_mwh : float
        Electricity used for hydrogen production [MWh].
    heat_produced_mwh : float
        Total heat produced [MWh thermal].
    hydrogen_produced_kg : float
        Total hydrogen produced [kg].
    hydrogen_to_power_mwh : float
        Electricity from hydrogen reconversion [MWh].
    curtailment_mwh : float
        Curtailed energy [MWh].
    curtailment_reduction_percent : float
        Reduction in curtailment vs electricity-only [%].
    overall_system_efficiency : float
        System-wide energy efficiency [-].
    renewable_utilization_percent : float
        Fraction of wind generation utilized [%].
    annual_revenue_meur : float
        Estimated annual revenue across all carriers [million EUR].
    hourly_hydrogen_storage_kg : NDArray
        Hourly hydrogen storage level [kg].
    """

    total_electricity_gen_mwh: float
    electricity_to_grid_mwh: float
    electricity_to_heat_mwh: float
    electricity_to_hydrogen_mwh: float
    heat_produced_mwh: float
    hydrogen_produced_kg: float
    hydrogen_to_power_mwh: float
    curtailment_mwh: float
    curtailment_reduction_percent: float
    overall_system_efficiency: float
    renewable_utilization_percent: float
    annual_revenue_meur: float
    hourly_hydrogen_storage_kg: NDArray[np.floating] = field(default_factory=lambda: np.array([]))


def run_sector_coupling(
    wind_generation_mw: NDArray[np.floating] | None = None,
    grid_capacity_mw: float = 400.0,
    electrolyzer_capacity_mw: float = 50.0,
    heat_pump_capacity_mw: float = 30.0,
    h2_storage_capacity_kg: float = H2_STORAGE_CAPACITY_KG,
    electricity_price_eur_mwh: NDArray[np.floating] | None = None,
    heat_price_eur_mwh: float = 40.0,
    hydrogen_price_eur_kg: float = 4.0,
) -> SectorCouplingResult:
    """Run sector coupling dispatch simulation.

    Priority: grid export > heat pump > electrolyzer > curtailment.
    Hydrogen reconversion when electricity price is high and H2 available.

    Parameters
    ----------
    wind_generation_mw : NDArray, optional
        Hourly wind generation [MW]. Default: synthetic 510 MW farm profile.
    grid_capacity_mw : float
        Grid export limit [MW]. Default: 400.
    electrolyzer_capacity_mw : float
        Electrolyzer capacity [MW]. Default: 50.
    heat_pump_capacity_mw : float
        Heat pump electrical input capacity [MW]. Default: 30.
    h2_storage_capacity_kg : float
        Hydrogen tank capacity [kg]. Default: 50000.
    electricity_price_eur_mwh : NDArray, optional
        Hourly electricity prices. Default: synthetic Polish DAM.
    heat_price_eur_mwh : float
        Heat revenue [EUR/MWh thermal]. Default: 40.
    hydrogen_price_eur_kg : float
        Hydrogen revenue [EUR/kg]. Default: 4.0.

    Returns
    -------
    SectorCouplingResult
        Sector coupling dispatch results.
    """
    n_hours = 8760

    # Default: synthetic wind generation profile (510 MW farm, ~45% CF)
    if wind_generation_mw is None:
        t = np.arange(n_hours)
        base = 230.0  # MW average
        seasonal = 80.0 * np.cos(2 * np.pi * t / n_hours)  # Winter peak
        diurnal = 20.0 * np.sin(2 * np.pi * t / 24.0)
        noise = np.random.default_rng(42).normal(0, 40, n_hours)
        wind_generation_mw = np.clip(base + seasonal + diurnal + noise, 0, 510)

    if electricity_price_eur_mwh is None:
        t = np.arange(n_hours)
        base_price = 55.0
        seasonal = -10.0 * np.cos(2 * np.pi * t / n_hours)
        diurnal = 15.0 * np.sin(2 * np.pi * (t - 6) / 24.0)
        noise = np.random.default_rng(99).normal(0, 10, n_hours)
        electricity_price_eur_mwh = np.clip(base_price + seasonal + diurnal + noise, 5, 200)

    # Dispatch simulation
    elec_to_grid = np.zeros(n_hours)
    elec_to_heat = np.zeros(n_hours)
    elec_to_h2 = np.zeros(n_hours)
    h2_to_power = np.zeros(n_hours)
    curtailment = np.zeros(n_hours)
    h2_storage = np.zeros(n_hours)
    h2_level = 0.0

    # Price threshold for hydrogen reconversion
    h2_reconversion_threshold = np.percentile(electricity_price_eur_mwh, 80)

    for h in range(n_hours):
        gen = float(wind_generation_mw[h])
        price = float(electricity_price_eur_mwh[h])
        remaining = gen

        # 1. Grid export (up to capacity)
        grid_export = min(remaining, grid_capacity_mw)
        elec_to_grid[h] = grid_export
        remaining -= grid_export

        # 2. Heat pump (when surplus and price is low)
        if remaining > 0:
            hp_input = min(remaining, heat_pump_capacity_mw)
            elec_to_heat[h] = hp_input
            remaining -= hp_input

        # 3. Electrolyzer (remaining surplus → hydrogen)
        if remaining > 0:
            ez_input = min(remaining, electrolyzer_capacity_mw)
            h2_produced = ez_input * ELECTROLYZER_EFFICIENCY / HYDROGEN_LHV_MWH_PER_KG  # kg
            h2_space = h2_storage_capacity_kg - h2_level
            actual_h2 = min(h2_produced, h2_space)
            actual_ez = (
                actual_h2 * HYDROGEN_LHV_MWH_PER_KG / ELECTROLYZER_EFFICIENCY
                if actual_h2 > 0
                else 0
            )
            elec_to_h2[h] = actual_ez
            h2_level += actual_h2
            remaining -= actual_ez

        # 4. Curtailment
        curtailment[h] = max(0, remaining)

        # 5. Hydrogen reconversion (when price is high)
        if price > h2_reconversion_threshold and h2_level > 100:
            h2_for_power_kg = min(h2_level * 0.1, 500)  # Max 500 kg/hour
            power_out = h2_for_power_kg * HYDROGEN_LHV_MWH_PER_KG * FUEL_CELL_EFFICIENCY
            h2_to_power[h] = power_out
            h2_level -= h2_for_power_kg

        h2_storage[h] = h2_level

    total_gen = float(np.sum(wind_generation_mw))
    total_grid = float(np.sum(elec_to_grid))
    total_heat_elec = float(np.sum(elec_to_heat))
    total_h2_elec = float(np.sum(elec_to_h2))
    total_curtail = float(np.sum(curtailment))
    total_h2_power = float(np.sum(h2_to_power))

    heat_produced = total_heat_elec * HEAT_PUMP_COP
    h2_produced_kg = total_h2_elec * ELECTROLYZER_EFFICIENCY / HYDROGEN_LHV_MWH_PER_KG

    # Curtailment without coupling = generation exceeding grid
    baseline_curtail = float(np.sum(np.maximum(wind_generation_mw - grid_capacity_mw, 0)))
    curtail_reduction = (
        (baseline_curtail - total_curtail) / baseline_curtail * 100.0
        if baseline_curtail > 0
        else 0.0
    )

    # Efficiency: useful energy out / total energy in
    useful_out = (
        total_grid + heat_produced + h2_produced_kg * HYDROGEN_LHV_MWH_PER_KG + total_h2_power
    )
    efficiency = useful_out / total_gen if total_gen > 0 else 0.0

    utilization = (total_gen - total_curtail) / total_gen * 100.0 if total_gen > 0 else 0.0

    # Revenue
    elec_revenue = float(np.sum(elec_to_grid * electricity_price_eur_mwh)) / 1e6
    h2_power_revenue = float(np.sum(h2_to_power * electricity_price_eur_mwh)) / 1e6
    heat_revenue = heat_produced * heat_price_eur_mwh / 1e6
    h2_revenue = h2_produced_kg * hydrogen_price_eur_kg / 1e6
    total_revenue = elec_revenue + h2_power_revenue + heat_revenue + h2_revenue

    return SectorCouplingResult(
        total_electricity_gen_mwh=round(total_gen, 1),
        electricity_to_grid_mwh=round(total_grid, 1),
        electricity_to_heat_mwh=round(total_heat_elec, 1),
        electricity_to_hydrogen_mwh=round(total_h2_elec, 1),
        heat_produced_mwh=round(heat_produced, 1),
        hydrogen_produced_kg=round(h2_produced_kg, 1),
        hydrogen_to_power_mwh=round(total_h2_power, 1),
        curtailment_mwh=round(total_curtail, 1),
        curtailment_reduction_percent=round(curtail_reduction, 1),
        overall_system_efficiency=round(efficiency, 3),
        renewable_utilization_percent=round(utilization, 1),
        annual_revenue_meur=round(total_revenue, 2),
        hourly_hydrogen_storage_kg=np.round(h2_storage, 1),
    )
