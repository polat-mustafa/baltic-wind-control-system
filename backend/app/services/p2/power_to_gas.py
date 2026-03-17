"""
Power-to-gas — electrolyzer modeling for green hydrogen production.

Physics
-------
Power-to-gas (P2G) converts surplus wind electricity to hydrogen via
water electrolysis:

    H₂O + electricity → H₂ + ½O₂

Electrolyzer technologies:

1. **PEM (Proton Exchange Membrane)**:
   - Fast response (ms), ideal for variable wind
   - Efficiency: 55-70% (LHV basis)
   - Stack lifetime: 60,000-80,000 hours
   - CAPEX: 1000-1500 EUR/kW (2025)

2. **Alkaline (AEL)**:
   - Mature technology, lower cost
   - Efficiency: 60-70% (LHV basis)
   - Slower ramp rates (minutes)
   - CAPEX: 500-800 EUR/kW (2025)

3. **Solid Oxide (SOEC)**:
   - High efficiency with external heat (80-90%)
   - Requires high temperature (700-900°C)
   - Suitable for CHP integration
   - CAPEX: 2000-3000 EUR/kW (2025)

Key parameters:
- Specific energy consumption: 50-55 kWh/kg H₂ (PEM)
- Water consumption: 9 L/kg H₂ (stoichiometric)
- Output pressure: 30 bar (PEM), atmospheric (AEL)

References
----------
- IRENA (2020). Green Hydrogen Cost Reduction: Scaling up Electrolysers.
- IEA (2023). Global Hydrogen Review 2023.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

# ── Electrolyzer Constants ─────────────────────────────────────

HYDROGEN_LHV_KWH_PER_KG: float = 33.3
"""Lower heating value of hydrogen [kWh/kg]."""

WATER_CONSUMPTION_L_PER_KG: float = 9.0
"""Water consumption per kg H₂ [litres]."""


class ElectrolyzerType(enum.Enum):
    """Electrolyzer technology type."""

    PEM = "pem"
    ALKALINE = "alkaline"
    SOEC = "soec"


ELECTROLYZER_SPECS: dict[str, dict[str, float | int]] = {
    "pem": {
        "efficiency": 0.65,
        "specific_energy_kwh_per_kg": 51.2,
        "min_load_fraction": 0.10,
        "ramp_rate_per_second": 0.10,
        "capex_eur_per_kw": 1200.0,
        "stack_lifetime_hours": 80000,
        "opex_fraction": 0.03,
    },
    "alkaline": {
        "efficiency": 0.68,
        "specific_energy_kwh_per_kg": 49.0,
        "min_load_fraction": 0.20,
        "ramp_rate_per_second": 0.02,
        "capex_eur_per_kw": 650.0,
        "stack_lifetime_hours": 90000,
        "opex_fraction": 0.02,
    },
    "soec": {
        "efficiency": 0.82,
        "specific_energy_kwh_per_kg": 40.6,
        "min_load_fraction": 0.30,
        "ramp_rate_per_second": 0.005,
        "capex_eur_per_kw": 2500.0,
        "stack_lifetime_hours": 40000,
        "opex_fraction": 0.04,
    },
}


@dataclass(frozen=True)
class ElectrolyzerResult:
    """Result of electrolyzer simulation.

    Attributes
    ----------
    technology : str
        Electrolyzer type.
    capacity_mw : float
        Rated capacity [MW].
    annual_hydrogen_production_tonnes : float
        Annual H₂ production [tonnes].
    annual_electricity_consumed_mwh : float
        Electricity consumed [MWh].
    capacity_factor : float
        Electrolyzer capacity factor [-].
    average_efficiency : float
        Average system efficiency [-].
    water_consumption_m3 : float
        Annual water consumption [m³].
    specific_energy_kwh_per_kg : float
        Realized specific energy [kWh/kg H₂].
    lcoh_eur_per_kg : float
        Levelized cost of hydrogen [EUR/kg].
    annual_opex_meur : float
        Annual operating cost [million EUR].
    capex_meur : float
        Capital cost [million EUR].
    hourly_h2_production_kg : NDArray
        Hourly production profile [kg/h].
    full_load_hours : float
        Equivalent full-load hours [h/year].
    """

    technology: str
    capacity_mw: float
    annual_hydrogen_production_tonnes: float
    annual_electricity_consumed_mwh: float
    capacity_factor: float
    average_efficiency: float
    water_consumption_m3: float
    specific_energy_kwh_per_kg: float
    lcoh_eur_per_kg: float
    annual_opex_meur: float
    capex_meur: float
    hourly_h2_production_kg: NDArray[np.floating] = field(default_factory=lambda: np.array([]))
    full_load_hours: float = 0.0


def run_electrolyzer_simulation(
    available_power_mw: NDArray[np.floating] | None = None,
    electrolyzer_capacity_mw: float = 50.0,
    technology: ElectrolyzerType = ElectrolyzerType.PEM,
    electricity_price_eur_mwh: NDArray[np.floating] | None = None,
    price_threshold_eur_mwh: float = 40.0,
    lifetime_years: int = 25,
    wacc: float = 0.07,
) -> ElectrolyzerResult:
    """Simulate electrolyzer operation with wind farm surplus power.

    The electrolyzer operates when:
    1. Surplus power is available (above grid export limit)
    2. Electricity price is below threshold

    Parameters
    ----------
    available_power_mw : NDArray, optional
        Hourly available surplus power [MW]. Default: synthetic.
    electrolyzer_capacity_mw : float
        Rated capacity [MW]. Default: 50.
    technology : ElectrolyzerType
        Electrolyzer type. Default: PEM.
    electricity_price_eur_mwh : NDArray, optional
        Hourly prices [EUR/MWh]. Default: synthetic.
    price_threshold_eur_mwh : float
        Maximum price for operation [EUR/MWh]. Default: 40.
    lifetime_years : int
        Project lifetime. Default: 25.
    wacc : float
        Discount rate. Default: 7%.

    Returns
    -------
    ElectrolyzerResult
        Electrolyzer performance and economics.
    """
    n_hours = 8760
    specs = ELECTROLYZER_SPECS[technology.value]

    if available_power_mw is None:
        t = np.arange(n_hours)
        rng = np.random.default_rng(42)
        base = 40.0
        seasonal = 20.0 * np.cos(2 * np.pi * t / n_hours)
        noise = rng.normal(0, 15, n_hours)
        available_power_mw = np.clip(base + seasonal + noise, 0, 100)

    if electricity_price_eur_mwh is None:
        t = np.arange(n_hours)
        rng = np.random.default_rng(99)
        base_price = 50.0
        seasonal = -8.0 * np.cos(2 * np.pi * t / n_hours)
        diurnal = 12.0 * np.sin(2 * np.pi * (t - 6) / 24.0)
        noise = rng.normal(0, 8, n_hours)
        electricity_price_eur_mwh = np.clip(base_price + seasonal + diurnal + noise, 5, 150)

    min_load = specs["min_load_fraction"] * electrolyzer_capacity_mw
    specific_energy = specs["specific_energy_kwh_per_kg"]

    hourly_h2 = np.zeros(n_hours)
    hourly_elec = np.zeros(n_hours)

    for h in range(n_hours):
        power = float(available_power_mw[h])
        price = float(electricity_price_eur_mwh[h])

        if price > price_threshold_eur_mwh:
            continue

        actual_power = min(power, electrolyzer_capacity_mw)
        if actual_power < min_load:
            continue

        h2_kg = actual_power * 1000.0 / specific_energy  # kW → kg/h
        hourly_h2[h] = h2_kg
        hourly_elec[h] = actual_power

    total_h2_kg = float(np.sum(hourly_h2))
    total_h2_tonnes = total_h2_kg / 1000.0
    total_elec_mwh = float(np.sum(hourly_elec))
    operating_hours = float(np.sum(hourly_elec > 0))

    cf = (
        total_elec_mwh / (electrolyzer_capacity_mw * n_hours) if electrolyzer_capacity_mw > 0 else 0
    )
    avg_eff = (
        (total_h2_kg * HYDROGEN_LHV_KWH_PER_KG) / (total_elec_mwh * 1000)
        if total_elec_mwh > 0
        else 0
    )
    water_m3 = total_h2_kg * WATER_CONSUMPTION_L_PER_KG / 1000.0
    realized_se = total_elec_mwh * 1000 / total_h2_kg if total_h2_kg > 0 else 0

    # Economics
    capex_meur = electrolyzer_capacity_mw * 1000 * specs["capex_eur_per_kw"] / 1e6
    annual_opex_meur = capex_meur * specs["opex_fraction"]

    crf = wacc * (1 + wacc) ** lifetime_years / ((1 + wacc) ** lifetime_years - 1)
    annual_capex = capex_meur * crf
    avg_elec_cost = (
        float(np.mean(electricity_price_eur_mwh[hourly_elec > 0])) if operating_hours > 0 else 50.0
    )
    annual_elec_cost = total_elec_mwh * avg_elec_cost / 1e6

    total_annual_cost = annual_capex + annual_opex_meur + annual_elec_cost
    lcoh = total_annual_cost * 1e6 / total_h2_kg if total_h2_kg > 0 else 999.0

    flh = total_elec_mwh / electrolyzer_capacity_mw if electrolyzer_capacity_mw > 0 else 0

    return ElectrolyzerResult(
        technology=technology.value,
        capacity_mw=electrolyzer_capacity_mw,
        annual_hydrogen_production_tonnes=round(total_h2_tonnes, 1),
        annual_electricity_consumed_mwh=round(total_elec_mwh, 1),
        capacity_factor=round(cf, 3),
        average_efficiency=round(avg_eff, 3),
        water_consumption_m3=round(water_m3, 1),
        specific_energy_kwh_per_kg=round(realized_se, 1),
        lcoh_eur_per_kg=round(lcoh, 2),
        annual_opex_meur=round(annual_opex_meur, 3),
        capex_meur=round(capex_meur, 2),
        hourly_h2_production_kg=np.round(hourly_h2, 2),
        full_load_hours=round(flh, 0),
    )
