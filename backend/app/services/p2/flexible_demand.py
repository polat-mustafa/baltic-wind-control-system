"""
Flexible demand — load shedding and demand-side management modeling.

Physics / Economics
-------------------
Flexible demand (demand-side response, DSR) allows electricity loads to
adjust their consumption in response to grid conditions:

1. **Load shedding**: Involuntary curtailment of demand during emergencies.
   Value of Lost Load (VOLL) in Poland: ~10,000 EUR/MWh.

2. **Load shifting**: Moving consumption from peak to off-peak hours.
   Typical shiftable fraction: 10-20% of industrial load.

3. **Elastic demand**: Price-responsive consumption where demand decreases
   as price increases, following a price elasticity:
     ΔQ/Q = ε × ΔP/P
   Short-run elasticity: -0.1 to -0.3

4. **Industrial DSR**: Large consumers (smelters, electrolysis, cold storage)
   can interrupt or shift demand for grid balancing payments.

For Baltic wind integration, flexible demand helps manage:
- Ramp events (sudden wind drops requiring load reduction)
- Curtailment reduction (increase demand when wind is abundant)
- Grid congestion management

References
----------
- PSE S.A. (2023). Polish Balancing Market rules and DSR participation.
- ENTSO-E (2022). Demand-Side Flexibility in European Power Systems.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray


# ── Flexible Demand Constants ──────────────────────────────────

VOLL_EUR_MWH: float = 10000.0
"""Value of Lost Load for Poland [EUR/MWh]."""

DEFAULT_PRICE_ELASTICITY: float = -0.15
"""Short-run price elasticity of demand [-]."""

PEAK_DEMAND_MW: float = 500.0
"""Default system peak demand [MW]."""


class DSRCategory(enum.Enum):
    """Demand-side response category."""
    INDUSTRIAL = "industrial"
    COMMERCIAL = "commercial"
    RESIDENTIAL = "residential"


DSR_SPECS: dict[str, dict] = {
    "industrial": {
        "shiftable_fraction": 0.20,
        "max_shift_hours": 4,
        "activation_cost_eur_mw": 50.0,
        "availability_hours": 8760,
        "response_time_minutes": 15,
    },
    "commercial": {
        "shiftable_fraction": 0.12,
        "max_shift_hours": 2,
        "activation_cost_eur_mw": 80.0,
        "availability_hours": 6000,
        "response_time_minutes": 30,
    },
    "residential": {
        "shiftable_fraction": 0.08,
        "max_shift_hours": 3,
        "activation_cost_eur_mw": 120.0,
        "availability_hours": 4000,
        "response_time_minutes": 60,
    },
}


@dataclass(frozen=True)
class FlexibleDemandResult:
    """Result of flexible demand analysis.

    Attributes
    ----------
    total_demand_mwh : float
        Total annual demand [MWh].
    shifted_demand_mwh : float
        Total shifted demand [MWh].
    shed_demand_mwh : float
        Total involuntarily shed demand [MWh].
    elastic_reduction_mwh : float
        Demand reduction from price elasticity [MWh].
    peak_demand_reduction_mw : float
        Peak demand reduction achieved [MW].
    peak_demand_reduction_percent : float
        Peak reduction as percentage [%].
    curtailment_reduction_mwh : float
        Wind curtailment avoided through demand increase [MWh].
    dsr_activation_cost_meur : float
        Total DSR activation cost [million EUR].
    avoided_voll_meur : float
        Avoided VOLL from load shedding prevention [million EUR].
    net_benefit_meur : float
        Net economic benefit [million EUR].
    hourly_modified_demand_mw : NDArray
        Modified demand profile [MW].
    n_shedding_events : int
        Number of load shedding events.
    """

    total_demand_mwh: float
    shifted_demand_mwh: float
    shed_demand_mwh: float
    elastic_reduction_mwh: float
    peak_demand_reduction_mw: float
    peak_demand_reduction_percent: float
    curtailment_reduction_mwh: float
    dsr_activation_cost_meur: float
    avoided_voll_meur: float
    net_benefit_meur: float
    hourly_modified_demand_mw: NDArray[np.floating] = field(
        default_factory=lambda: np.array([])
    )
    n_shedding_events: int = 0


def run_flexible_demand_simulation(
    base_demand_mw: NDArray[np.floating] | None = None,
    wind_generation_mw: NDArray[np.floating] | None = None,
    electricity_price_eur_mwh: NDArray[np.floating] | None = None,
    dsr_categories: list[DSRCategory] | None = None,
    price_elasticity: float = DEFAULT_PRICE_ELASTICITY,
    grid_capacity_mw: float = 450.0,
) -> FlexibleDemandResult:
    """Simulate flexible demand dispatch over one year.

    Parameters
    ----------
    base_demand_mw : NDArray, optional
        Hourly base demand [MW]. Default: synthetic profile.
    wind_generation_mw : NDArray, optional
        Hourly wind generation [MW]. Default: synthetic.
    electricity_price_eur_mwh : NDArray, optional
        Hourly prices. Default: synthetic.
    dsr_categories : list[DSRCategory], optional
        Active DSR categories. Default: all three.
    price_elasticity : float
        Short-run price elasticity. Default: -0.15.
    grid_capacity_mw : float
        Grid supply limit [MW]. Default: 450.

    Returns
    -------
    FlexibleDemandResult
        Demand flexibility analysis results.
    """
    n_hours = 8760
    rng = np.random.default_rng(42)

    if base_demand_mw is None:
        t = np.arange(n_hours)
        base = 350.0
        seasonal = 40.0 * np.cos(2 * np.pi * t / n_hours)  # Winter peak
        diurnal = 60.0 * np.sin(2 * np.pi * (t - 6) / 24.0)  # Day peak
        weekly = 20.0 * np.sin(2 * np.pi * t / 168.0)
        noise = rng.normal(0, 15, n_hours)
        base_demand_mw = np.clip(base + seasonal + diurnal + weekly + noise, 150, 550)

    if wind_generation_mw is None:
        t = np.arange(n_hours)
        base_wind = 230.0
        seasonal = 80.0 * np.cos(2 * np.pi * t / n_hours)
        noise = rng.normal(0, 40, n_hours)
        wind_generation_mw = np.clip(base_wind + seasonal + noise, 0, 510)

    if electricity_price_eur_mwh is None:
        t = np.arange(n_hours)
        base_price = 55.0
        seasonal = -10.0 * np.cos(2 * np.pi * t / n_hours)
        diurnal = 15.0 * np.sin(2 * np.pi * (t - 6) / 24.0)
        noise = rng.normal(0, 10, n_hours)
        electricity_price_eur_mwh = np.clip(base_price + seasonal + diurnal + noise, 5, 200)

    if dsr_categories is None:
        dsr_categories = [DSRCategory.INDUSTRIAL, DSRCategory.COMMERCIAL, DSRCategory.RESIDENTIAL]

    # Compute total shiftable capacity
    total_shiftable_fraction = sum(
        DSR_SPECS[c.value]["shiftable_fraction"] for c in dsr_categories
    )
    avg_activation_cost = float(np.mean([
        DSR_SPECS[c.value]["activation_cost_eur_mw"] for c in dsr_categories
    ]))

    mean_price = float(np.mean(electricity_price_eur_mwh))
    modified_demand = base_demand_mw.copy()
    shifted = np.zeros(n_hours)
    shed = np.zeros(n_hours)
    elastic_reduction = np.zeros(n_hours)
    curtail_avoided = np.zeros(n_hours)

    shedding_events = 0

    for h in range(n_hours):
        demand = float(base_demand_mw[h])
        price = float(electricity_price_eur_mwh[h])
        wind = float(wind_generation_mw[h])

        # 1. Price elasticity
        price_ratio = (price - mean_price) / mean_price if mean_price > 0 else 0
        elastic_change = demand * price_elasticity * price_ratio
        elastic_reduction[h] = max(0, -elastic_change)
        demand += elastic_change

        # 2. Load shifting: shift demand from high-price to low-price hours
        shiftable_mw = demand * total_shiftable_fraction
        if price > mean_price * 1.3:
            shift = min(shiftable_mw * 0.5, demand * 0.15)
            shifted[h] = shift
            demand -= shift
        elif price < mean_price * 0.7:
            # Absorb shifted load + excess wind
            extra = min(shiftable_mw * 0.3, max(0, wind - grid_capacity_mw))
            curtail_avoided[h] = extra
            demand += extra

        # 3. Emergency load shedding
        available_supply = wind + grid_capacity_mw
        if demand > available_supply:
            deficit = demand - available_supply
            shed[h] = deficit
            demand = available_supply
            shedding_events += 1

        modified_demand[h] = max(0, demand)

    total_demand = float(np.sum(base_demand_mw))
    total_shifted = float(np.sum(shifted))
    total_shed = float(np.sum(shed))
    total_elastic = float(np.sum(elastic_reduction))
    total_curtail_avoided = float(np.sum(curtail_avoided))

    peak_original = float(np.max(base_demand_mw))
    peak_modified = float(np.max(modified_demand))
    peak_reduction = peak_original - peak_modified
    peak_reduction_pct = peak_reduction / peak_original * 100 if peak_original > 0 else 0

    activation_cost = (total_shifted + total_curtail_avoided) * avg_activation_cost / 1e6
    avoided_voll = total_shed * VOLL_EUR_MWH / 1e6  # Hypothetical without DSR
    net_benefit = avoided_voll - activation_cost

    return FlexibleDemandResult(
        total_demand_mwh=round(total_demand, 1),
        shifted_demand_mwh=round(total_shifted, 1),
        shed_demand_mwh=round(total_shed, 1),
        elastic_reduction_mwh=round(total_elastic, 1),
        peak_demand_reduction_mw=round(peak_reduction, 1),
        peak_demand_reduction_percent=round(peak_reduction_pct, 1),
        curtailment_reduction_mwh=round(total_curtail_avoided, 1),
        dsr_activation_cost_meur=round(activation_cost, 3),
        avoided_voll_meur=round(avoided_voll, 3),
        net_benefit_meur=round(net_benefit, 3),
        hourly_modified_demand_mw=np.round(modified_demand, 1),
        n_shedding_events=shedding_events,
    )
