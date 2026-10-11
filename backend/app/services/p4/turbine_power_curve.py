"""
IEC 61400-12-1 power curve of the SB-510 turbine for the P4 forecasting modules.

SB-510's turbines are "V236 class" (Vestas V236-15.0 MW); Vestas publishes no power
curve, so the farm is modelled with the IEA 15 MW reference turbine — the official
IEA Wind Task 37 table, the same data as P1 (``services/p1/turbine_models.py``).
Every ML prediction is validated against this curve (Rule 1, physical constraints).

Physics — Wind Energy Conversion
---------------------------------
The power available in the wind through the rotor swept area is

  P_wind = 0.5 × ρ × A × v³

and the turbine converts the fraction Cp into electrical power:

  P_electrical = 0.5 × ρ × A × Cp(v) × v³        (Betz: Cp ≤ 16/27 ≈ 0.593)

The IEA 15 MW table gives Cp_electrical ≈ 0.442 in region 2 (aerodynamic 0.462 times
the 95.7 % generator efficiency of the workbook Overview).

Standard — IEC 61400-12-1 Power Performance Testing
----------------------------------------------------
  - Hub-height wind, 10-minute averages, method of bins (0.5 m/s)
  - Air density normalisation to 1.225 kg/m³. For a pitch-regulated turbine with
    active power control the wind speed is normalised (§9.1.5):
        v_n = v × (ρ / ρ₀)^(1/3)
    so the curve at another density is P_ρ(v) = P_ref(v × (ρ/ρ₀)^(1/3)).

The power curve has 4 regions (IEA 15 MW, workbook Overview):
  Region 1: v < 3 m/s          → P = 0 (cut-in)
  Region 2: 3 ≤ v < 10.66 m/s  → variable speed, Cp tracking (5–7.56 rpm)
  Region 3: 10.66 ≤ v ≤ 25 m/s → P = 15 MW, pitch-regulated
  Region 4: v > 25 m/s         → P = 0 (cut-out)

Maths — IEA 15 MW parameters (IEA-15-240-RWT_tabular.xlsx, tag v1.1.18)
------------------------------------------------------------------------
Rotor diameter 241.35 m, swept area π × 120.675² = 45,750 m², hub height 150 m,
rated 15 MW at 10.66 m/s, low-speed direct drive (no gearbox), rotor 5–7.56 rpm.

References
----------
- Gaertner, E. et al. (2020). Definition of the IEA 15-Megawatt Offshore Reference
  Wind Turbine. NREL/TP-5000-75698.
- IEC 61400-12-1:2017 — Power performance measurements of electricity producing
  wind turbines
- Burton et al., "Wind Energy Handbook", 2nd edition, Wiley
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p1.turbine_models import DEFAULT_TURBINE_ID, get_turbine

# ── Physical Constants ────────────────────────────────────────────

R_DRY: float = 287.05  # Specific gas constant for dry air [J/(kg·K)]
STANDARD_PRESSURE_PA: float = 101_325.0  # Standard atmospheric pressure [Pa]
STANDARD_TEMP_K: float = 288.15  # Standard temperature (15°C) [K]
STANDARD_AIR_DENSITY: float = 1.225  # Reference air density of the table [kg/m³]


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class TurbineSpec:
    """SB-510 turbine ("V236 class") = the IEA 15 MW reference turbine.

    Every value comes from the official IEA Wind Task 37 workbook
    (``services/p1/turbine_models.py``); ``get_turbine_spec()`` fills it.
    """

    model_id: str
    name: str
    rotor_diameter_m: float
    hub_height_m: float
    rated_power_mw: float
    cut_in_speed_ms: float
    rated_speed_ms: float
    cut_out_speed_ms: float
    num_blades: int
    cp_max: float  # maximum electrical power coefficient of the table
    ct_rated: float  # thrust coefficient at rated wind speed
    drivetrain: str
    gearbox_ratio: float  # 1.0: direct drive
    generator_efficiency: float
    min_rotor_rpm: float
    max_rotor_rpm: float
    nacelle_mass_kg: float
    rna_mass_kg: float


@dataclass(frozen=True)
class PowerCurveResult:
    """Complete power curve data for a turbine specification.

    Contains parallel arrays: wind_speeds_ms[i] corresponds to
    power_mw[i] and ct[-][i]. Used by SCADA generator and all
    ML validation modules.
    """

    spec: TurbineSpec
    wind_speeds_ms: NDArray[np.float64]
    power_mw: NDArray[np.float64]
    ct: NDArray[np.float64]
    swept_area_m2: float
    air_density_kg_m3: float


# ── Pure Functions ────────────────────────────────────────────────


def get_turbine_spec(model_id: str = DEFAULT_TURBINE_ID) -> TurbineSpec:
    """The SB-510 turbine specification from the official IEA table."""
    t = get_turbine(model_id)
    return TurbineSpec(
        model_id=t.id,
        name=f"{t.name} ({t.id})",
        rotor_diameter_m=t.rotor_diameter_m,
        hub_height_m=t.hub_height_m,
        rated_power_mw=t.rated_mw,
        cut_in_speed_ms=t.cut_in_ms,
        rated_speed_ms=t.rated_ms,
        cut_out_speed_ms=t.cut_out_ms,
        num_blades=3,
        cp_max=round(float(t.cp.max()), 4),
        ct_rated=round(float(np.interp(t.rated_ms, t.ws_ms, t.ct)), 4),
        drivetrain=t.drivetrain,
        gearbox_ratio=1.0,
        generator_efficiency=t.generator_efficiency,
        min_rotor_rpm=t.min_rotor_rpm,
        max_rotor_rpm=t.max_rotor_rpm,
        nacelle_mass_kg=t.masses_t["nacelle"] * 1e3,
        rna_mass_kg=t.masses_t["rna"] * 1e3,
    )


def compute_swept_area_m2(rotor_diameter_m: float) -> float:
    """Compute rotor swept area [m²].

    A = π × (D/2)²

    For the IEA 15 MW: A = π × 120.675² = 45,750 m²
    """
    radius = rotor_diameter_m / 2.0
    return math.pi * radius * radius
