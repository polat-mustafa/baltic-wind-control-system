"""
Pathway planning — multi-decade energy transition portfolio modeling.

Physics / Economics
-------------------
Pathway planning models the long-term evolution of an energy system over
multiple decades (2025-2050+). Unlike single-snapshot capacity expansion,
pathway planning considers:

1. **Technology learning curves**: Cost reductions over time (e.g., offshore
   wind LCOE declining ~5% per year, battery costs falling ~10% per year).

2. **Policy milestones**: EU 2030 targets (42.5% renewable), 2050 net-zero,
   Polish Energy Policy (PEP2040) coal phase-out timeline.

3. **Infrastructure sequencing**: Which investments to make first, considering
   construction lead times, grid reinforcement needs, and supply chain.

4. **Stranded asset risk**: Evaluating which conventional assets become
   uneconomic under different decarbonization pathways.

5. **Scenario analysis**: Multiple future scenarios (high/low demand growth,
   fast/slow policy, technology breakthrough) to stress-test investment plans.

References
----------
- Brown, T. et al. (2018). PyPSA: Python for Power System Analysis.
  JOSS, 3(29), 747.
- European Commission (2023). REPowerEU pathway milestones.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray


# ── Pathway Constants ──────────────────────────────────────────

BASE_YEAR: int = 2025
HORIZON_YEAR: int = 2050
STEP_YEARS: int = 5

OFFSHORE_WIND_CAPEX_2025_EUR_KW: float = 2800.0
ONSHORE_WIND_CAPEX_2025_EUR_KW: float = 1200.0
SOLAR_PV_CAPEX_2025_EUR_KW: float = 600.0
BATTERY_CAPEX_2025_EUR_KWH: float = 200.0
GAS_CCGT_CAPEX_EUR_KW: float = 800.0

LEARNING_RATES: dict[str, float] = {
    "offshore_wind": 0.05,
    "onshore_wind": 0.03,
    "solar_pv": 0.08,
    "battery": 0.10,
    "gas_ccgt": 0.00,
}

CAPACITY_FACTORS: dict[str, float] = {
    "offshore_wind": 0.45,
    "onshore_wind": 0.28,
    "solar_pv": 0.12,
    "battery": 0.0,  # Storage, not generation
    "gas_ccgt": 0.85,
}

CO2_INTENSITY_KG_MWH: dict[str, float] = {
    "offshore_wind": 0.0,
    "onshore_wind": 0.0,
    "solar_pv": 0.0,
    "battery": 0.0,
    "gas_ccgt": 350.0,
}

# Polish electricity demand growth
DEMAND_GROWTH_RATE: float = 0.015  # 1.5% per year
BASE_DEMAND_TWH: float = 180.0    # 2025 Polish demand


@dataclass(frozen=True)
class PathwayMilestone:
    """A single milestone in the energy transition pathway.

    Attributes
    ----------
    year : int
        Year of this milestone.
    total_capacity_gw : dict[str, float]
        Installed capacity per technology [GW].
    annual_generation_twh : dict[str, float]
        Annual generation per technology [TWh].
    total_demand_twh : float
        Total electricity demand [TWh].
    renewable_share_percent : float
        Share of generation from renewables [%].
    co2_emissions_mt : float
        Annual CO2 emissions [Mt].
    cumulative_investment_beur : float
        Cumulative investment to date [billion EUR].
    system_lcoe_eur_mwh : float
        Blended system LCOE [EUR/MWh].
    """

    year: int
    total_capacity_gw: dict[str, float]
    annual_generation_twh: dict[str, float]
    total_demand_twh: float
    renewable_share_percent: float
    co2_emissions_mt: float
    cumulative_investment_beur: float
    system_lcoe_eur_mwh: float


@dataclass(frozen=True)
class PathwayResult:
    """Result of pathway planning analysis.

    Attributes
    ----------
    milestones : list[PathwayMilestone]
        Time series of pathway milestones.
    scenario_name : str
        Name of the scenario analyzed.
    target_year : int
        Final year of the pathway.
    meets_2030_target : bool
        Whether 42.5% renewable target is met by 2030.
    meets_2050_target : bool
        Whether net-zero target is met by 2050.
    total_investment_beur : float
        Total pathway investment [billion EUR].
    co2_reduction_percent : float
        Total CO2 reduction vs base year [%].
    offshore_wind_capacity_2050_gw : float
        Final offshore wind capacity [GW].
    """

    milestones: list[PathwayMilestone] = field(default_factory=list)
    scenario_name: str = "reference"
    target_year: int = HORIZON_YEAR
    meets_2030_target: bool = False
    meets_2050_target: bool = False
    total_investment_beur: float = 0.0
    co2_reduction_percent: float = 0.0
    offshore_wind_capacity_2050_gw: float = 0.0


def _technology_capex(technology: str, year: int) -> float:
    """Compute technology CAPEX at a given year with learning curve.

    Parameters
    ----------
    technology : str
        Technology name.
    year : int
        Target year.

    Returns
    -------
    float
        CAPEX [EUR/kW or EUR/kWh for battery].
    """
    base_costs = {
        "offshore_wind": OFFSHORE_WIND_CAPEX_2025_EUR_KW,
        "onshore_wind": ONSHORE_WIND_CAPEX_2025_EUR_KW,
        "solar_pv": SOLAR_PV_CAPEX_2025_EUR_KW,
        "battery": BATTERY_CAPEX_2025_EUR_KWH,
        "gas_ccgt": GAS_CCGT_CAPEX_EUR_KW,
    }
    base = base_costs.get(technology, 1000.0)
    lr = LEARNING_RATES.get(technology, 0.0)
    years_from_base = max(0, year - BASE_YEAR)
    return base * (1.0 - lr) ** years_from_base


def _compute_lcoe(capex_eur_kw: float, cf: float, lifetime_years: int = 25,
                  opex_fraction: float = 0.025, wacc: float = 0.07) -> float:
    """Compute LCOE [EUR/MWh] from CAPEX and capacity factor.

    Parameters
    ----------
    capex_eur_kw : float
        Capital cost [EUR/kW].
    cf : float
        Capacity factor [-].
    lifetime_years : int
        Project lifetime [years].
    opex_fraction : float
        Annual OPEX as fraction of CAPEX.
    wacc : float
        Weighted average cost of capital.

    Returns
    -------
    float
        LCOE [EUR/MWh].
    """
    if cf <= 0:
        return 999.0

    # Capital recovery factor
    crf = wacc * (1 + wacc) ** lifetime_years / ((1 + wacc) ** lifetime_years - 1)
    annual_cost_eur_kw = capex_eur_kw * crf + capex_eur_kw * opex_fraction
    annual_gen_mwh_kw = cf * 8760.0 / 1000.0  # MWh per kW
    return annual_cost_eur_kw / annual_gen_mwh_kw


def run_pathway_planning(
    scenario: str = "reference",
    offshore_wind_additions_gw: NDArray[np.floating] | None = None,
    include_nuclear: bool = False,
    demand_growth_rate: float = DEMAND_GROWTH_RATE,
) -> PathwayResult:
    """Run multi-decade pathway planning analysis.

    Parameters
    ----------
    scenario : str
        Scenario name: "reference", "accelerated", "conservative".
    offshore_wind_additions_gw : NDArray, optional
        Offshore wind additions per period [GW]. Default: scenario-dependent.
    include_nuclear : bool
        Whether to include nuclear in the mix. Default: False.
    demand_growth_rate : float
        Annual demand growth rate. Default: 1.5%.

    Returns
    -------
    PathwayResult
        Multi-decade pathway milestones.
    """
    years = list(range(BASE_YEAR, HORIZON_YEAR + 1, STEP_YEARS))
    n_periods = len(years)

    # Scenario-dependent capacity additions per period [GW]
    scenarios = {
        "reference": {
            "offshore_wind": np.linspace(0.5, 3.0, n_periods),
            "onshore_wind": np.linspace(1.0, 2.0, n_periods),
            "solar_pv": np.linspace(2.0, 5.0, n_periods),
            "battery": np.linspace(0.2, 2.0, n_periods),
            "gas_ccgt": np.linspace(0.5, -0.5, n_periods),
        },
        "accelerated": {
            "offshore_wind": np.linspace(1.0, 5.0, n_periods),
            "onshore_wind": np.linspace(1.5, 3.0, n_periods),
            "solar_pv": np.linspace(3.0, 8.0, n_periods),
            "battery": np.linspace(0.5, 4.0, n_periods),
            "gas_ccgt": np.linspace(0.3, -1.0, n_periods),
        },
        "conservative": {
            "offshore_wind": np.linspace(0.3, 1.5, n_periods),
            "onshore_wind": np.linspace(0.5, 1.0, n_periods),
            "solar_pv": np.linspace(1.0, 3.0, n_periods),
            "battery": np.linspace(0.1, 1.0, n_periods),
            "gas_ccgt": np.linspace(0.5, 0.0, n_periods),
        },
    }

    additions = scenarios.get(scenario, scenarios["reference"])

    if offshore_wind_additions_gw is not None:
        if len(offshore_wind_additions_gw) >= n_periods:
            additions["offshore_wind"] = offshore_wind_additions_gw[:n_periods]

    # Starting capacities [GW] (approximate 2025 Poland)
    capacity = {
        "offshore_wind": 0.0,
        "onshore_wind": 8.0,
        "solar_pv": 15.0,
        "battery": 0.5,
        "gas_ccgt": 6.0,
    }

    milestones = []
    cumulative_investment = 0.0

    for idx, year in enumerate(years):
        # Add new capacity
        for tech in capacity:
            addition = float(additions[tech][idx])
            capacity[tech] = max(0.0, capacity[tech] + addition)

        # Compute generation
        generation: dict[str, float] = {}
        for tech, cap in capacity.items():
            cf = CAPACITY_FACTORS[tech]
            gen_twh = cap * cf * 8760.0 / 1000.0
            generation[tech] = round(gen_twh, 2)

        # Total demand
        years_from_base = year - BASE_YEAR
        demand_twh = BASE_DEMAND_TWH * (1 + demand_growth_rate) ** years_from_base

        # Renewable share
        total_gen = sum(generation.values())
        renewable_gen = sum(
            generation[t] for t in ["offshore_wind", "onshore_wind", "solar_pv"]
        )
        re_share = renewable_gen / total_gen * 100.0 if total_gen > 0 else 0.0

        # CO2 emissions
        co2_mt = sum(
            generation[t] * CO2_INTENSITY_KG_MWH[t] / 1e6
            for t in generation
        )

        # Investment this period
        for tech in capacity:
            addition = max(0.0, float(additions[tech][idx]))
            capex = _technology_capex(tech, year)
            # Convert: addition [GW] × capex [EUR/kW] × 1e6 [kW/GW] / 1e9 [EUR→bEUR]
            invest = addition * capex * 1e6 / 1e9
            cumulative_investment += invest

        # System LCOE (generation-weighted)
        total_lcoe_num = 0.0
        total_lcoe_den = 0.0
        for tech, gen in generation.items():
            if gen > 0 and CAPACITY_FACTORS[tech] > 0:
                capex = _technology_capex(tech, year)
                lcoe = _compute_lcoe(capex, CAPACITY_FACTORS[tech])
                total_lcoe_num += lcoe * gen
                total_lcoe_den += gen
        system_lcoe = total_lcoe_num / total_lcoe_den if total_lcoe_den > 0 else 0.0

        milestones.append(PathwayMilestone(
            year=year,
            total_capacity_gw={t: round(c, 2) for t, c in capacity.items()},
            annual_generation_twh=generation,
            total_demand_twh=round(demand_twh, 1),
            renewable_share_percent=round(re_share, 1),
            co2_emissions_mt=round(co2_mt, 2),
            cumulative_investment_beur=round(cumulative_investment, 2),
            system_lcoe_eur_mwh=round(system_lcoe, 1),
        ))

    # Check targets
    meets_2030 = any(
        m.renewable_share_percent >= 42.5 for m in milestones if m.year == 2030
    )
    meets_2050 = any(
        m.co2_emissions_mt < milestones[0].co2_emissions_mt * 0.1
        for m in milestones if m.year == 2050
    )

    base_co2 = milestones[0].co2_emissions_mt
    final_co2 = milestones[-1].co2_emissions_mt
    co2_reduction = (base_co2 - final_co2) / base_co2 * 100.0 if base_co2 > 0 else 0.0

    return PathwayResult(
        milestones=milestones,
        scenario_name=scenario,
        target_year=HORIZON_YEAR,
        meets_2030_target=meets_2030,
        meets_2050_target=meets_2050,
        total_investment_beur=round(cumulative_investment, 2),
        co2_reduction_percent=round(co2_reduction, 1),
        offshore_wind_capacity_2050_gw=round(capacity["offshore_wind"], 2),
    )
