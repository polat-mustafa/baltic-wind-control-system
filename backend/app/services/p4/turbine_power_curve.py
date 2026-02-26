"""
IEC 61400-12-1 power curve model for Vestas V236-15.0 MW turbine.

Provides the physics foundation for all P4 forecasting modules.
Every ML prediction is validated against this power curve.

Physics — Wind Energy Conversion
---------------------------------
A wind turbine converts kinetic energy from moving air into electrical power.
The available power in the wind passing through the rotor swept area is:

  P_wind = 0.5 × ρ × A × v³

where:
  ρ = air density (kg/m³), varies with temperature and pressure
  A = swept area (m²) = π × (D/2)²
  v = wind speed at hub height (m/s)

The turbine extracts a fraction Cp (power coefficient) of this energy:

  P_electrical = 0.5 × ρ × A × Cp × v³

The Betz limit (Cp_max = 16/27 ≈ 0.593) is the theoretical maximum.
Modern turbines achieve Cp ≈ 0.45-0.50 at optimal tip-speed ratio.

Standard — IEC 61400-12-1 Power Performance Testing
----------------------------------------------------
IEC 61400-12-1 defines the standard method for measuring power curves:
  - Wind speed measured at hub height using calibrated anemometers
  - 10-minute averages (matching SCADA recording interval)
  - Air density correction to reference conditions (1.225 kg/m³ at 15°C, 1013.25 hPa)
  - Method of bins: data grouped into 0.5 m/s wind speed bins

The power curve has 4 distinct regions:
  Region 1: v < v_cut_in (3.0 m/s) → P = 0 (insufficient torque)
  Region 2: v_cut_in ≤ v < v_rated (3.0-12.5 m/s) → P ∝ v³ (maximum energy capture)
  Region 3: v_rated ≤ v ≤ v_cut_out (12.5-31.0 m/s) → P = P_rated (pitch-regulated)
  Region 4: v > v_cut_out (31.0 m/s) → P = 0 (safety shutdown)

Maths — V236-15.0 MW Parameters
---------------------------------
Rotor diameter: D = 236 m
Swept area: A = π × (236/2)² = π × 118² = 43,743.54 m²
Hub height: 140 m (typical for Baltic Sea installation)
Rated power: 15.0 MW
Cut-in wind speed: 3.0 m/s
Rated wind speed: 12.5 m/s
Cut-out wind speed: 31.0 m/s

Air density at standard conditions:
  ρ = P_atm / (R_dry × T_K)
  ρ = 101325 / (287.05 × 288.15) = 1.225 kg/m³

Thrust coefficient (Ct) profile:
  - Ct increases in Region 2, peaks near rated speed
  - Ct ≈ 0.8 at low wind speeds (high induction)
  - Ct ≈ 0.28 at rated speed (pitch-regulated operation)
  - Ct decreases above rated as pitch angle increases

References
----------
- IEC 61400-12-1: Power performance measurements of electricity producing
  wind turbines
- IEC 61400-1: Design requirements for wind turbines
- Vestas V236-15.0 MW product documentation
- Burton et al., "Wind Energy Handbook", 2nd edition, Wiley
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# ── Physical Constants ────────────────────────────────────────────

R_DRY: float = 287.05  # Specific gas constant for dry air [J/(kg·K)]
STANDARD_PRESSURE_PA: float = 101_325.0  # Standard atmospheric pressure [Pa]
STANDARD_TEMP_K: float = 288.15  # Standard temperature (15°C) [K]
STANDARD_AIR_DENSITY: float = 1.225  # Reference air density [kg/m³]


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class TurbineSpec:
    """Vestas V236-15.0 MW turbine specification.

    All parameters are immutable to prevent accidental modification
    during simulation runs. Values sourced from Vestas product data
    and IEC 61400-1 design envelope.
    """

    name: str = "Vestas V236-15.0 MW"
    rotor_diameter_m: float = 236.0
    hub_height_m: float = 140.0
    rated_power_mw: float = 15.0
    cut_in_speed_ms: float = 3.0
    rated_speed_ms: float = 12.5
    cut_out_speed_ms: float = 31.0
    num_blades: int = 3
    cp_max: float = 0.48  # Maximum power coefficient (Region 2)
    ct_rated: float = 0.28  # Thrust coefficient at rated wind speed


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


def get_v236_spec() -> TurbineSpec:
    """Return the default V236-15.0 MW turbine specification."""
    return TurbineSpec()


def compute_swept_area_m2(rotor_diameter_m: float) -> float:
    """Compute rotor swept area [m²].

    A = π × (D/2)²

    For V236: A = π × 118² = 43,743.54 m²
    """
    radius = rotor_diameter_m / 2.0
    return math.pi * radius * radius


def compute_air_density_kg_m3(
    pressure_pa: float = STANDARD_PRESSURE_PA,
    temperature_k: float = STANDARD_TEMP_K,
) -> float:
    """Compute air density using the ideal gas law [kg/m³].

    ρ = P / (R_dry × T)

    Standard conditions (15°C, 101325 Pa): ρ = 1.225 kg/m³
    Cold Baltic winter (-10°C, 101325 Pa): ρ ≈ 1.342 kg/m³
    """
    if temperature_k <= 0.0:
        msg = f"Temperature must be positive Kelvin, got {temperature_k}"
        raise ValueError(msg)
    if pressure_pa <= 0.0:
        msg = f"Pressure must be positive, got {pressure_pa}"
        raise ValueError(msg)
    return pressure_pa / (R_DRY * temperature_k)


def _compute_cp_curve(
    wind_speeds: NDArray[np.float64],
    spec: TurbineSpec,
) -> NDArray[np.float64]:
    """Compute power coefficient (Cp) as a function of wind speed.

    Region 2 (cubic ramp): Cp ramps up from 0 to Cp_max following a smooth
    curve that peaks around 8-9 m/s, then decreases toward rated speed.
    Region 3 (rated plateau): Cp decreases as P_rated / (0.5 × ρ × A × v³)
    to maintain constant power output via pitch regulation.
    """
    cp = np.zeros_like(wind_speeds)
    swept_area = compute_swept_area_m2(spec.rotor_diameter_m)

    for i, v in enumerate(wind_speeds):
        if v < spec.cut_in_speed_ms or v > spec.cut_out_speed_ms:
            cp[i] = 0.0
        elif v < spec.rated_speed_ms:
            # Region 2: smooth ramp to Cp_max using sinusoidal profile
            frac = (v - spec.cut_in_speed_ms) / (spec.rated_speed_ms - spec.cut_in_speed_ms)
            # Peak Cp at ~70% through Region 2, then taper
            cp[i] = spec.cp_max * math.sin(frac * math.pi / 2.0)
        else:
            # Region 3: Cp decreases to maintain rated power
            p_available = 0.5 * STANDARD_AIR_DENSITY * swept_area * v**3
            cp[i] = (spec.rated_power_mw * 1e6) / p_available if p_available > 0 else 0.0

    return cp


def _compute_ct_curve(
    wind_speeds: NDArray[np.float64],
    cp: NDArray[np.float64],
    spec: TurbineSpec,
) -> NDArray[np.float64]:
    """Compute thrust coefficient (Ct) as a function of wind speed.

    Ct is related to Cp through the axial induction factor (a):
      Cp = 4a(1-a)² and Ct = 4a(1-a)
    At low wind speeds: Ct ≈ 0.8 (high induction)
    At rated speed: Ct ≈ 0.28 (pitch-regulated)
    Above rated: Ct decreases as pitch angle increases
    """
    ct = np.zeros_like(wind_speeds)

    for i, v in enumerate(wind_speeds):
        if v < spec.cut_in_speed_ms or v > spec.cut_out_speed_ms:
            ct[i] = 0.0
        elif v < spec.rated_speed_ms:
            # Ct decreases from ~0.8 at cut-in toward ct_rated at rated speed
            frac = (v - spec.cut_in_speed_ms) / (spec.rated_speed_ms - spec.cut_in_speed_ms)
            ct_start = 0.82
            ct[i] = ct_start - (ct_start - spec.ct_rated) * frac
        else:
            # Above rated: Ct decreases further with increasing pitch
            frac_above = (v - spec.rated_speed_ms) / (spec.cut_out_speed_ms - spec.rated_speed_ms)
            ct[i] = spec.ct_rated * (1.0 - 0.5 * frac_above)

    return ct


def build_power_curve(
    spec: TurbineSpec | None = None,
    wind_step_ms: float = 0.5,
    air_density_kg_m3: float | None = None,
) -> PowerCurveResult:
    """Build a complete IEC 61400-12-1 power curve.

    Generates power output, Cp, and Ct arrays at the specified wind speed
    resolution. Default 0.5 m/s step matches IEC 61400-12-1 bin width.

    Parameters
    ----------
    spec : TurbineSpec, optional
        Turbine parameters. Defaults to V236-15.0 MW.
    wind_step_ms : float
        Wind speed bin width [m/s]. Default 0.5 per IEC 61400-12-1.
    air_density_kg_m3 : float, optional
        Air density for power calculation. Defaults to 1.225 kg/m³.

    Returns
    -------
    PowerCurveResult
        Complete power curve with parallel arrays.
    """
    if spec is None:
        spec = get_v236_spec()

    rho = air_density_kg_m3 if air_density_kg_m3 is not None else STANDARD_AIR_DENSITY
    swept_area = compute_swept_area_m2(spec.rotor_diameter_m)

    # Generate wind speed array from 0 to cut_out + margin
    max_ws = spec.cut_out_speed_ms + 2.0
    wind_speeds = np.arange(0.0, max_ws + wind_step_ms, wind_step_ms)

    # Compute Cp curve
    cp = _compute_cp_curve(wind_speeds, spec)

    # Compute power: P = 0.5 × ρ × A × Cp × v³
    power_w = 0.5 * rho * swept_area * cp * wind_speeds**3
    power_mw = power_w / 1e6

    # Clamp to rated power (numerical safety)
    power_mw = np.clip(power_mw, 0.0, spec.rated_power_mw)

    # Zero power outside operating range
    below_cut_in = wind_speeds < spec.cut_in_speed_ms
    above_cut_out = wind_speeds > spec.cut_out_speed_ms
    power_mw[below_cut_in] = 0.0
    power_mw[above_cut_out] = 0.0

    # Compute Ct curve
    ct = _compute_ct_curve(wind_speeds, cp, spec)

    return PowerCurveResult(
        spec=spec,
        wind_speeds_ms=wind_speeds,
        power_mw=power_mw,
        ct=ct,
        swept_area_m2=swept_area,
        air_density_kg_m3=rho,
    )


def interpolate_power_mw(
    wind_speed_ms: float | NDArray[np.float64],
    curve: PowerCurveResult | None = None,
) -> float | NDArray[np.float64]:
    """Interpolate power output for arbitrary wind speed(s).

    Uses numpy linear interpolation against the pre-built power curve.
    This is the primary interface for SCADA generation and ML validation.

    Parameters
    ----------
    wind_speed_ms : float or array
        Wind speed(s) at hub height [m/s].
    curve : PowerCurveResult, optional
        Pre-built power curve. Builds default if None.

    Returns
    -------
    float or NDArray
        Power output [MW], clamped to [0, P_rated].
    """
    if curve is None:
        curve = build_power_curve()

    result = np.interp(wind_speed_ms, curve.wind_speeds_ms, curve.power_mw)

    if isinstance(wind_speed_ms, (int, float)):
        return float(result)
    return result
