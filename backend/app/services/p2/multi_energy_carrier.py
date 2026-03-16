"""
Multi-energy carrier integration — electricity, gas, heat, hydrogen coupling.

Physics
-------
A multi-energy carrier system integrates multiple energy vectors through
conversion technologies, storage, and transport networks:

    Electricity ←→ Heat (heat pumps, electric boilers, CHP)
    Electricity ←→ Hydrogen (electrolyzers, fuel cells)
    Hydrogen ←→ Gas (methanation: CO₂ + 4H₂ → CH₄ + 2H₂O)
    Gas ←→ Heat (gas boilers, CHP)
    Gas ←→ Electricity (gas turbines, fuel cells)

The integrated system is described by a coupling matrix M:

    [P_elec]     [η_ee  η_eg  η_eh  η_eH2] [Source_elec]
    [P_gas ]  =  [η_ge  η_gg  η_gh  η_gH2] [Source_gas ]
    [P_heat]     [η_he  η_hg  η_hh  η_hH2] [Source_heat]
    [P_H2  ]     [η_H2e η_H2g η_H2h η_H2H2] [Source_H2 ]

This formulation enables optimization across all carriers simultaneously.

References
----------
- Geidl, M. & Andersson, G. (2007). Optimal coupling of energy hubs.
  IEEE Trans. Power Systems, 22(1), 145-155.
- Mancarella, P. (2014). MES (multi-energy systems): An overview of concepts
  and evaluation models. Energy, 65, 1-17.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray


# ── Multi-Energy Constants ─────────────────────────────────────

NATURAL_GAS_LHV_MWH_PER_KG: float = 0.0139
"""Natural gas LHV [MWh/kg]."""

HYDROGEN_LHV_MWH_PER_KG: float = 0.0333
"""Hydrogen LHV [MWh/kg]."""

CO2_PER_MWH_GAS: float = 0.202
"""CO₂ emissions per MWh of natural gas [tonnes]."""


@dataclass(frozen=True)
class EnergyCarrierBalance:
    """Balance for a single energy carrier over the simulation.

    Attributes
    ----------
    carrier : str
        Carrier name (electricity, heat, gas, hydrogen).
    total_supply_mwh : float
        Total energy supplied [MWh].
    total_demand_mwh : float
        Total energy demanded [MWh].
    conversion_in_mwh : float
        Energy received from other carriers [MWh].
    conversion_out_mwh : float
        Energy sent to other carriers [MWh].
    surplus_mwh : float
        Unmet supply (curtailment) [MWh].
    deficit_mwh : float
        Unmet demand [MWh].
    """

    carrier: str
    total_supply_mwh: float
    total_demand_mwh: float
    conversion_in_mwh: float
    conversion_out_mwh: float
    surplus_mwh: float
    deficit_mwh: float


@dataclass(frozen=True)
class MultiEnergyResult:
    """Result of multi-energy carrier system analysis.

    Attributes
    ----------
    carrier_balances : list[EnergyCarrierBalance]
        Per-carrier energy balances.
    total_primary_energy_mwh : float
        Total primary energy input [MWh].
    total_useful_energy_mwh : float
        Total useful energy delivered [MWh].
    system_efficiency : float
        Overall multi-energy system efficiency [-].
    co2_emissions_tonnes : float
        Total CO₂ emissions [tonnes].
    co2_reduction_vs_separate_percent : float
        CO₂ reduction vs separate systems [%].
    total_annual_cost_meur : float
        Total system operating cost [million EUR].
    coupling_matrix : NDArray
        Energy coupling matrix showing conversion flows [MWh].
    renewable_share_percent : float
        Share of renewable energy in total supply [%].
    """

    carrier_balances: list[EnergyCarrierBalance] = field(default_factory=list)
    total_primary_energy_mwh: float = 0.0
    total_useful_energy_mwh: float = 0.0
    system_efficiency: float = 0.0
    co2_emissions_tonnes: float = 0.0
    co2_reduction_vs_separate_percent: float = 0.0
    total_annual_cost_meur: float = 0.0
    coupling_matrix: NDArray[np.floating] = field(
        default_factory=lambda: np.zeros((4, 4))
    )
    renewable_share_percent: float = 0.0


def run_multi_energy_analysis(
    wind_generation_mwh: float = 2_000_000.0,
    electricity_demand_mwh: float = 1_800_000.0,
    heat_demand_mwh: float = 500_000.0,
    hydrogen_demand_mwh: float = 100_000.0,
    gas_supply_mwh: float = 300_000.0,
    heat_pump_cop: float = 3.5,
    electrolyzer_efficiency: float = 0.65,
    fuel_cell_efficiency: float = 0.50,
    gas_boiler_efficiency: float = 0.90,
    chp_elec_efficiency: float = 0.40,
    chp_heat_efficiency: float = 0.45,
    methanation_efficiency: float = 0.60,
    electricity_price_eur_mwh: float = 55.0,
    gas_price_eur_mwh: float = 35.0,
    heat_price_eur_mwh: float = 40.0,
    hydrogen_price_eur_mwh: float = 120.0,
) -> MultiEnergyResult:
    """Analyze multi-energy carrier system with coupled flows.

    Parameters
    ----------
    wind_generation_mwh : float
        Annual wind electricity [MWh].
    electricity_demand_mwh : float
        Annual electricity demand [MWh].
    heat_demand_mwh : float
        Annual heat demand [MWh].
    hydrogen_demand_mwh : float
        Annual hydrogen demand [MWh].
    gas_supply_mwh : float
        Available gas supply [MWh].
    heat_pump_cop : float
        Heat pump COP [-].
    electrolyzer_efficiency : float
        Electrolyzer efficiency [-].
    fuel_cell_efficiency : float
        Fuel cell efficiency [-].
    gas_boiler_efficiency : float
        Gas boiler efficiency [-].
    chp_elec_efficiency, chp_heat_efficiency : float
        CHP efficiencies [-].
    methanation_efficiency : float
        P2G methanation efficiency [-].
    electricity_price_eur_mwh : float
        Electricity price [EUR/MWh].
    gas_price_eur_mwh : float
        Gas price [EUR/MWh].
    heat_price_eur_mwh : float
        Heat price [EUR/MWh].
    hydrogen_price_eur_mwh : float
        Hydrogen price [EUR/MWh].

    Returns
    -------
    MultiEnergyResult
        Multi-energy system analysis results.
    """
    # Build coupling matrix: rows = output carriers, cols = input carriers
    # [elec, gas, heat, hydrogen]
    coupling = np.zeros((4, 4))

    # Step 1: Direct electricity supply to demand
    elec_direct = min(wind_generation_mwh, electricity_demand_mwh)
    elec_surplus = wind_generation_mwh - elec_direct
    elec_deficit = electricity_demand_mwh - elec_direct
    coupling[0, 0] = elec_direct

    # Step 2: Surplus electricity → hydrogen (electrolyzer)
    elec_to_h2 = min(elec_surplus, hydrogen_demand_mwh / electrolyzer_efficiency)
    h2_from_elec = elec_to_h2 * electrolyzer_efficiency
    elec_surplus -= elec_to_h2
    coupling[3, 0] = h2_from_elec

    # Step 3: Surplus electricity → heat (heat pump)
    heat_from_hp_input = min(elec_surplus, heat_demand_mwh / heat_pump_cop)
    heat_from_hp = heat_from_hp_input * heat_pump_cop
    elec_surplus -= heat_from_hp_input
    coupling[2, 0] = heat_from_hp

    # Step 4: Gas → CHP (electricity + heat)
    gas_for_chp = min(gas_supply_mwh, elec_deficit / chp_elec_efficiency) if elec_deficit > 0 else 0
    elec_from_chp = gas_for_chp * chp_elec_efficiency
    heat_from_chp = gas_for_chp * chp_heat_efficiency
    gas_remaining = gas_supply_mwh - gas_for_chp
    coupling[0, 1] = elec_from_chp
    coupling[2, 1] = heat_from_chp

    # Step 5: Remaining gas → boiler for heat
    remaining_heat_demand = max(0, heat_demand_mwh - heat_from_hp - heat_from_chp)
    gas_for_boiler = min(gas_remaining, remaining_heat_demand / gas_boiler_efficiency)
    heat_from_boiler = gas_for_boiler * gas_boiler_efficiency
    coupling[2, 1] += heat_from_boiler

    # Step 6: H₂ → fuel cell for remaining electricity deficit
    remaining_elec_deficit = max(0, elec_deficit - elec_from_chp)
    h2_surplus = max(0, h2_from_elec - hydrogen_demand_mwh)
    if remaining_elec_deficit > 0 and h2_surplus > 0:
        h2_for_fc = min(h2_surplus, remaining_elec_deficit / fuel_cell_efficiency)
        elec_from_fc = h2_for_fc * fuel_cell_efficiency
        coupling[0, 3] = elec_from_fc

    # Carrier balances
    total_elec_supply = wind_generation_mwh + elec_from_chp + coupling[0, 3]
    total_heat_supply = heat_from_hp + heat_from_chp + heat_from_boiler
    total_h2_supply = h2_from_elec
    total_gas_used = gas_for_chp + gas_for_boiler

    balances = [
        EnergyCarrierBalance(
            carrier="electricity",
            total_supply_mwh=round(total_elec_supply, 1),
            total_demand_mwh=round(electricity_demand_mwh, 1),
            conversion_in_mwh=round(elec_from_chp + coupling[0, 3], 1),
            conversion_out_mwh=round(elec_to_h2 + heat_from_hp_input, 1),
            surplus_mwh=round(elec_surplus, 1),
            deficit_mwh=round(max(0, remaining_elec_deficit - coupling[0, 3]), 1),
        ),
        EnergyCarrierBalance(
            carrier="gas",
            total_supply_mwh=round(gas_supply_mwh, 1),
            total_demand_mwh=round(total_gas_used, 1),
            conversion_in_mwh=0.0,
            conversion_out_mwh=round(total_gas_used, 1),
            surplus_mwh=round(max(0, gas_supply_mwh - total_gas_used), 1),
            deficit_mwh=0.0,
        ),
        EnergyCarrierBalance(
            carrier="heat",
            total_supply_mwh=round(total_heat_supply, 1),
            total_demand_mwh=round(heat_demand_mwh, 1),
            conversion_in_mwh=round(total_heat_supply, 1),
            conversion_out_mwh=0.0,
            surplus_mwh=round(max(0, total_heat_supply - heat_demand_mwh), 1),
            deficit_mwh=round(max(0, heat_demand_mwh - total_heat_supply), 1),
        ),
        EnergyCarrierBalance(
            carrier="hydrogen",
            total_supply_mwh=round(total_h2_supply, 1),
            total_demand_mwh=round(hydrogen_demand_mwh, 1),
            conversion_in_mwh=round(h2_from_elec, 1),
            conversion_out_mwh=round(coupling[0, 3], 1),
            surplus_mwh=round(max(0, total_h2_supply - hydrogen_demand_mwh - coupling[0, 3] / fuel_cell_efficiency), 1),
            deficit_mwh=round(max(0, hydrogen_demand_mwh - h2_from_elec), 1),
        ),
    ]

    # System metrics
    total_primary = wind_generation_mwh + gas_supply_mwh
    total_useful = min(total_elec_supply, electricity_demand_mwh) + min(total_heat_supply, heat_demand_mwh) + min(total_h2_supply, hydrogen_demand_mwh)
    system_eff = total_useful / total_primary if total_primary > 0 else 0

    co2 = total_gas_used * CO2_PER_MWH_GAS
    # Separate system CO₂: all heat from gas boiler, all electricity from gas
    separate_co2 = (
        heat_demand_mwh / gas_boiler_efficiency * CO2_PER_MWH_GAS
        + max(0, electricity_demand_mwh - wind_generation_mwh) / 0.55 * CO2_PER_MWH_GAS
    )
    co2_reduction = (separate_co2 - co2) / separate_co2 * 100.0 if separate_co2 > 0 else 0

    re_share = wind_generation_mwh / total_primary * 100 if total_primary > 0 else 0

    # Cost
    cost = (
        total_gas_used * gas_price_eur_mwh / 1e6
    )

    return MultiEnergyResult(
        carrier_balances=balances,
        total_primary_energy_mwh=round(total_primary, 1),
        total_useful_energy_mwh=round(total_useful, 1),
        system_efficiency=round(system_eff, 3),
        co2_emissions_tonnes=round(co2, 1),
        co2_reduction_vs_separate_percent=round(co2_reduction, 1),
        total_annual_cost_meur=round(cost, 3),
        coupling_matrix=np.round(coupling, 1),
        renewable_share_percent=round(re_share, 1),
    )
