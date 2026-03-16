"""
Seasonal storage — long-duration energy storage modeling.

Physics
-------
Seasonal storage addresses the fundamental mismatch between wind resource
(winter peak) and demand patterns. Unlike batteries (hours), seasonal
storage operates on weeks-to-months timescales:

1. **Hydrogen cavern storage**: Salt caverns store compressed H₂ at
   50-200 bar. Capacity: 100-1000 GWh. Round-trip efficiency: ~35%
   (electrolyzer + compression + fuel cell).

2. **Compressed Air Energy Storage (CAES)**: Underground caverns store
   compressed air. Capacity: 100+ MWh. Efficiency: 60-70% (adiabatic).

3. **Pumped Hydro Storage (PHS)**: Water between upper/lower reservoirs.
   Capacity: GWh scale. Efficiency: 75-85%. Limited by geography.

4. **Power-to-methane**: CO₂ + 4H₂ → CH₄ + 2H₂O (Sabatier reaction).
   Uses existing gas infrastructure. Round-trip: ~30%.

For Baltic offshore wind, hydrogen cavern storage is most relevant:
- Salt formations exist in the Polish Baltic region
- Excess winter generation → hydrogen → summer reconversion
- Decouples wind farm from instantaneous grid constraints

References
----------
- Staffell, I. et al. (2019). The role of hydrogen and fuel cells in
  the global energy system. Energy & Environmental Science, 12(2).
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

# ── Seasonal Storage Constants ─────────────────────────────────

HYDROGEN_LHV_MWH_PER_KG: float = 0.0333


class StorageTechnology(enum.Enum):
    """Long-duration storage technology."""

    HYDROGEN_CAVERN = "hydrogen_cavern"
    COMPRESSED_AIR = "compressed_air"
    PUMPED_HYDRO = "pumped_hydro"


STORAGE_SPECS: dict[str, dict[str, float | int]] = {
    "hydrogen_cavern": {
        "charge_efficiency": 0.65,  # Electrolyzer
        "discharge_efficiency": 0.50,  # Fuel cell
        "self_discharge_per_day": 0.0001,  # Negligible
        "capex_eur_per_kwh": 2.0,  # Very low per kWh (large caverns)
        "capex_eur_per_kw_charge": 1200.0,  # Electrolyzer
        "capex_eur_per_kw_discharge": 1500.0,  # Fuel cell
        "max_cycles_per_year": 50,
        "lifetime_years": 30,
    },
    "compressed_air": {
        "charge_efficiency": 0.80,
        "discharge_efficiency": 0.82,
        "self_discharge_per_day": 0.001,
        "capex_eur_per_kwh": 10.0,
        "capex_eur_per_kw_charge": 600.0,
        "capex_eur_per_kw_discharge": 600.0,
        "max_cycles_per_year": 200,
        "lifetime_years": 40,
    },
    "pumped_hydro": {
        "charge_efficiency": 0.87,
        "discharge_efficiency": 0.90,
        "self_discharge_per_day": 0.0005,
        "capex_eur_per_kwh": 50.0,
        "capex_eur_per_kw_charge": 800.0,
        "capex_eur_per_kw_discharge": 800.0,
        "max_cycles_per_year": 365,
        "lifetime_years": 50,
    },
}


@dataclass(frozen=True)
class SeasonalStorageResult:
    """Result of seasonal storage simulation.

    Attributes
    ----------
    technology : str
        Storage technology name.
    storage_capacity_mwh : float
        Energy storage capacity [MWh].
    charge_capacity_mw : float
        Charging power capacity [MW].
    discharge_capacity_mw : float
        Discharging power capacity [MW].
    annual_energy_stored_mwh : float
        Total energy stored [MWh].
    annual_energy_discharged_mwh : float
        Total energy discharged [MWh].
    round_trip_efficiency : float
        Realized round-trip efficiency [-].
    storage_cycles : int
        Number of full cycles per year.
    peak_soc_mwh : float
        Peak state of charge [MWh].
    min_soc_mwh : float
        Minimum state of charge [MWh].
    arbitrage_revenue_meur : float
        Revenue from price arbitrage [million EUR].
    capex_meur : float
        Total capital cost [million EUR].
    lcoes_eur_mwh : float
        Levelized cost of energy storage [EUR/MWh].
    hourly_soc_mwh : NDArray
        Hourly state of charge [MWh].
    """

    technology: str
    storage_capacity_mwh: float
    charge_capacity_mw: float
    discharge_capacity_mw: float
    annual_energy_stored_mwh: float
    annual_energy_discharged_mwh: float
    round_trip_efficiency: float
    storage_cycles: int
    peak_soc_mwh: float
    min_soc_mwh: float
    arbitrage_revenue_meur: float
    capex_meur: float
    lcoes_eur_mwh: float
    hourly_soc_mwh: NDArray[np.floating] = field(default_factory=lambda: np.array([]))


def run_seasonal_storage_simulation(
    surplus_power_mw: NDArray[np.floating] | None = None,
    deficit_power_mw: NDArray[np.floating] | None = None,
    technology: StorageTechnology = StorageTechnology.HYDROGEN_CAVERN,
    storage_capacity_mwh: float = 5000.0,
    charge_capacity_mw: float = 50.0,
    discharge_capacity_mw: float = 50.0,
    electricity_price_eur_mwh: NDArray[np.floating] | None = None,
    wacc: float = 0.07,
) -> SeasonalStorageResult:
    """Simulate seasonal storage dispatch over one year.

    Charges when surplus exists (or price is low), discharges when deficit
    exists (or price is high).

    Parameters
    ----------
    surplus_power_mw : NDArray, optional
        Hourly surplus power available for charging [MW].
    deficit_power_mw : NDArray, optional
        Hourly power deficit requiring discharge [MW].
    technology : StorageTechnology
        Storage technology. Default: hydrogen cavern.
    storage_capacity_mwh : float
        Storage capacity [MWh]. Default: 5000.
    charge_capacity_mw : float
        Max charge rate [MW]. Default: 50.
    discharge_capacity_mw : float
        Max discharge rate [MW]. Default: 50.
    electricity_price_eur_mwh : NDArray, optional
        Hourly prices. Default: synthetic.
    wacc : float
        Discount rate. Default: 7%.

    Returns
    -------
    SeasonalStorageResult
        Seasonal storage performance and economics.
    """
    n_hours = 8760
    specs = STORAGE_SPECS[technology.value]

    if surplus_power_mw is None:
        t = np.arange(n_hours)
        rng = np.random.default_rng(42)
        seasonal = 60.0 * np.cos(2 * np.pi * t / n_hours)  # Winter surplus
        noise = rng.normal(0, 20, n_hours)
        surplus_power_mw = np.clip(30 + seasonal + noise, 0, 150)

    if deficit_power_mw is None:
        t = np.arange(n_hours)
        rng = np.random.default_rng(73)
        seasonal = -40.0 * np.cos(2 * np.pi * t / n_hours)  # Summer deficit
        noise = rng.normal(0, 15, n_hours)
        deficit_power_mw = np.clip(20 + seasonal + noise, 0, 100)

    if electricity_price_eur_mwh is None:
        t = np.arange(n_hours)
        rng = np.random.default_rng(99)
        base = 55.0
        seasonal = -10.0 * np.cos(2 * np.pi * t / n_hours)
        diurnal = 12.0 * np.sin(2 * np.pi * (t - 6) / 24.0)
        noise = rng.normal(0, 10, n_hours)
        electricity_price_eur_mwh = np.clip(base + seasonal + diurnal + noise, 5, 200)

    charge_eff = specs["charge_efficiency"]
    discharge_eff = specs["discharge_efficiency"]
    self_discharge = specs["self_discharge_per_day"] / 24.0

    soc = np.zeros(n_hours)
    charge_energy = np.zeros(n_hours)
    discharge_energy = np.zeros(n_hours)
    current_soc = 0.0

    price_median = float(np.median(electricity_price_eur_mwh))

    for h in range(n_hours):
        # Self-discharge
        current_soc *= 1.0 - self_discharge

        surplus = float(surplus_power_mw[h])
        deficit = float(deficit_power_mw[h])
        price = float(electricity_price_eur_mwh[h])

        # Charge: when surplus exists and price is below median
        if surplus > 0 and price < price_median:
            charge_mw = min(surplus, charge_capacity_mw)
            stored = charge_mw * charge_eff
            space = storage_capacity_mwh - current_soc
            actual_stored = min(stored, space)
            charge_energy[h] = actual_stored / charge_eff if charge_eff > 0 else 0
            current_soc += actual_stored

        # Discharge: when deficit exists and price is above median
        if deficit > 0 and price >= price_median and current_soc > 0:
            discharge_mw = min(deficit, discharge_capacity_mw)
            needed_from_storage = discharge_mw / discharge_eff
            available = current_soc
            actual_from_storage = min(needed_from_storage, available)
            discharge_energy[h] = actual_from_storage * discharge_eff
            current_soc -= actual_from_storage

        soc[h] = current_soc

    total_charged = float(np.sum(charge_energy))
    total_discharged = float(np.sum(discharge_energy))
    rt_eff = total_discharged / total_charged if total_charged > 0 else 0.0

    # Count cycles (full equivalent)
    cycles = int(total_charged / storage_capacity_mwh) if storage_capacity_mwh > 0 else 0

    # Revenue from arbitrage
    revenue = (
        float(
            np.sum(
                discharge_energy * electricity_price_eur_mwh
                - charge_energy * electricity_price_eur_mwh
            )
        )
        / 1e6
    )

    # CAPEX
    energy_capex = storage_capacity_mwh * specs["capex_eur_per_kwh"] * 1000 / 1e6
    charge_capex = charge_capacity_mw * 1000 * specs["capex_eur_per_kw_charge"] / 1e6
    discharge_capex = discharge_capacity_mw * 1000 * specs["capex_eur_per_kw_discharge"] / 1e6
    total_capex = energy_capex + charge_capex + discharge_capex

    # LCOES
    lifetime = specs["lifetime_years"]
    crf = wacc * (1 + wacc) ** lifetime / ((1 + wacc) ** lifetime - 1)
    annual_cost = total_capex * crf
    lcoes = annual_cost * 1e6 / total_discharged if total_discharged > 0 else 999.0

    return SeasonalStorageResult(
        technology=technology.value,
        storage_capacity_mwh=storage_capacity_mwh,
        charge_capacity_mw=charge_capacity_mw,
        discharge_capacity_mw=discharge_capacity_mw,
        annual_energy_stored_mwh=round(total_charged, 1),
        annual_energy_discharged_mwh=round(total_discharged, 1),
        round_trip_efficiency=round(rt_eff, 3),
        storage_cycles=cycles,
        peak_soc_mwh=round(float(np.max(soc)), 1),
        min_soc_mwh=round(float(np.min(soc)), 1),
        arbitrage_revenue_meur=round(revenue, 3),
        capex_meur=round(total_capex, 2),
        lcoes_eur_mwh=round(lcoes, 1),
        hourly_soc_mwh=np.round(soc, 1),
    )
