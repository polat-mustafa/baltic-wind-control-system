"""
Wind rose analysis: directional statistics, sector Weibull fits, energy rose.

This module converts hub-height wind speed and direction time series into
a directional wind resource characterisation — the wind rose. The wind rose
quantifies how wind energy is distributed across compass sectors, which
directly influences turbine layout optimisation and AEP estimation.

Physics Pipeline
----------------
1. Classify each measurement into directional sectors (12 × 30° or 16 × 22.5°)
2. Compute frequency of occurrence per sector
3. Compute mean wind speed per sector
4. Fit sector-wise Weibull distributions
5. Compute energy rose: E_sector ∝ f_sector × v̄_sector³ (cubic law)
6. Compute circular standard deviation (directional variability)

References
----------
- IEC 61400-12-1: Wind turbine power performance measurement
- Mardia, K.V. (1972): Statistics of Directional Data
- European Wind Atlas (Risø, 1989): Wind rose methodology

Constants (Baltic Wind Alpha)
-----------------------------
- Default sectors: 12 (30° each, industry standard)
- Expected dominant direction: WSW (~240°) for Polish Baltic Sea
- Expected circular std: 60–80° (moderate directional spread)
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p1.data_processing import WeibullParameters, fit_weibull


@dataclass(frozen=True)
class WindRoseResult:
    """Complete wind rose analysis result.

    Attributes
    ----------
    sector_centres_deg : NDArray
        Centre direction of each sector [deg]. Shape: (num_sectors,).
    frequencies : NDArray
        Fraction of time wind blows from each sector [-]. Sums to 1.0.
    mean_speeds_ms : NDArray
        Mean wind speed per sector [m/s]. NaN for empty sectors.
    sector_weibull : list[WeibullParameters | None]
        Weibull fit per sector. None if insufficient data.
    energy_fractions : NDArray
        Fraction of total energy from each sector [-]. Sums to 1.0.
    dominant_direction_deg : float
        Direction of the most frequent sector [deg].
    circular_std_deg : float
        Circular standard deviation of all directions [deg].
    num_sectors : int
        Number of directional sectors used.
    """

    sector_centres_deg: NDArray[np.floating]
    frequencies: NDArray[np.floating]
    mean_speeds_ms: NDArray[np.floating]
    sector_weibull: list[WeibullParameters | None]
    energy_fractions: NDArray[np.floating]
    dominant_direction_deg: float
    circular_std_deg: float
    num_sectors: int


def classify_direction_sector(
    directions_deg: NDArray[np.floating],
    num_sectors: int = 12,
) -> NDArray[np.intp]:
    """
    Classify wind directions into directional sectors.

    Each sector spans 360°/num_sectors, centred on the sector midpoint.
    Sector 0 is centred on 0° (North), sector 1 on 360°/num_sectors, etc.

    The sector boundary is offset by half a sector width so that sector 0
    captures directions from (360 - width/2) to (width/2).

    Parameters
    ----------
    directions_deg : NDArray
        Wind directions [deg], 0–360 meteorological convention.
    num_sectors : int
        Number of sectors. Default: 12 (30° each).

    Returns
    -------
    NDArray[np.intp]
        Sector index for each direction, 0 to num_sectors-1.
    """
    sector_width_deg = 360.0 / num_sectors
    # Shift by half-sector so sector 0 is centred on North (0°)
    shifted = (directions_deg + sector_width_deg / 2.0) % 360.0
    indices: NDArray[np.intp] = (shifted / sector_width_deg).astype(np.intp)
    # Clamp to valid range (handles floating-point edge case at 360°)
    indices = np.clip(indices, 0, num_sectors - 1)
    return indices


def compute_sector_frequencies(
    sector_indices: NDArray[np.intp],
    num_sectors: int,
) -> NDArray[np.floating]:
    """
    Compute normalised frequency of occurrence per sector.

    Parameters
    ----------
    sector_indices : NDArray
        Sector index for each observation.
    num_sectors : int
        Total number of sectors.

    Returns
    -------
    NDArray
        Frequency per sector [-]. Sums to 1.0.
    """
    counts = np.bincount(sector_indices, minlength=num_sectors).astype(np.float64)
    total = counts.sum()
    if total == 0:
        return np.zeros(num_sectors, dtype=np.float64)
    frequencies: NDArray[np.floating] = counts / total
    return frequencies


def compute_sector_mean_speed_ms(
    speeds_ms: NDArray[np.floating],
    sector_indices: NDArray[np.intp],
    num_sectors: int,
) -> NDArray[np.floating]:
    """
    Compute mean wind speed per directional sector.

    Parameters
    ----------
    speeds_ms : NDArray
        Wind speed measurements [m/s].
    sector_indices : NDArray
        Sector index for each measurement.
    num_sectors : int
        Total number of sectors.

    Returns
    -------
    NDArray
        Mean wind speed per sector [m/s]. NaN for empty sectors.
    """
    mean_speeds = np.full(num_sectors, np.nan, dtype=np.float64)
    for sector in range(num_sectors):
        mask = sector_indices == sector
        if mask.any():
            mean_speeds[sector] = float(np.mean(speeds_ms[mask]))
    return mean_speeds


def fit_sector_weibull(
    speeds_ms: NDArray[np.floating],
    sector_indices: NDArray[np.intp],
    num_sectors: int,
) -> list[WeibullParameters | None]:
    """
    Fit Weibull distribution to wind speeds in each sector.

    Parameters
    ----------
    speeds_ms : NDArray
        Wind speed measurements [m/s].
    sector_indices : NDArray
        Sector index for each measurement.
    num_sectors : int
        Total number of sectors.

    Returns
    -------
    list[WeibullParameters | None]
        Weibull parameters per sector. None if insufficient data (< 100 points).
    """
    results: list[WeibullParameters | None] = []
    for sector in range(num_sectors):
        mask = sector_indices == sector
        sector_speeds = speeds_ms[mask]
        try:
            params = fit_weibull(sector_speeds)
            results.append(params)
        except ValueError:
            # Insufficient data for Weibull fit
            results.append(None)
    return results


def compute_energy_rose(
    frequencies: NDArray[np.floating],
    mean_speeds_ms: NDArray[np.floating],
) -> NDArray[np.floating]:
    """
    Compute energy fraction per sector using the cubic law.

    Wind power is proportional to v³, so the energy contribution from
    each sector scales as: E_i ∝ f_i × v̄_i³

    Parameters
    ----------
    frequencies : NDArray
        Sector frequencies [-]. Shape: (num_sectors,).
    mean_speeds_ms : NDArray
        Mean speed per sector [m/s]. Shape: (num_sectors,).

    Returns
    -------
    NDArray
        Normalised energy fraction per sector [-]. Sums to 1.0.
        Zero for sectors with NaN speeds.
    """
    # Replace NaN with 0 for computation
    speeds_clean = np.where(np.isnan(mean_speeds_ms), 0.0, mean_speeds_ms)
    energy_raw = frequencies * speeds_clean**3
    total_energy = energy_raw.sum()
    if total_energy == 0:
        return np.zeros_like(frequencies)
    result: NDArray[np.floating] = energy_raw / total_energy
    return result


def compute_circular_std_deg(
    directions_deg: NDArray[np.floating],
) -> float:
    """
    Compute circular standard deviation using Mardia's formula.

    Circular statistics handle the wrap-around at 0°/360°. The circular
    variance is: V = 1 - R̄, where R̄ is the mean resultant length.
    Circular std dev: σ_c = √(-2 × ln(R̄)) × (180/π)

    Parameters
    ----------
    directions_deg : NDArray
        Wind directions [deg].

    Returns
    -------
    float
        Circular standard deviation [deg].
    """
    if len(directions_deg) == 0:
        return 0.0

    theta_rad = np.deg2rad(directions_deg)
    mean_cos = float(np.mean(np.cos(theta_rad)))
    mean_sin = float(np.mean(np.sin(theta_rad)))
    r_bar = np.sqrt(mean_cos**2 + mean_sin**2)

    # Clamp R̄ to avoid log(0) — R̄ = 0 means perfectly uniform distribution
    r_bar = max(r_bar, 1e-10)

    circular_std_rad = np.sqrt(-2.0 * np.log(r_bar))
    return float(np.degrees(circular_std_rad))


def compute_wind_rose(
    speeds_ms: NDArray[np.floating],
    directions_deg: NDArray[np.floating],
    num_sectors: int = 12,
) -> WindRoseResult:
    """
    Compute complete wind rose analysis from speed and direction time series.

    Orchestrates all wind rose computations into a single result object.

    Parameters
    ----------
    speeds_ms : NDArray
        Wind speed measurements [m/s].
    directions_deg : NDArray
        Wind direction measurements [deg], meteorological convention.
    num_sectors : int
        Number of directional sectors. Default: 12 (30° each).

    Returns
    -------
    WindRoseResult
        Complete wind rose with frequencies, speeds, Weibull fits, and energy rose.

    Raises
    ------
    ValueError
        If input arrays have different lengths or are empty.
    """
    if len(speeds_ms) != len(directions_deg):
        msg = (
            f"Speed and direction arrays must have equal length: "
            f"{len(speeds_ms)} vs {len(directions_deg)}"
        )
        raise ValueError(msg)
    if len(speeds_ms) == 0:
        msg = "Input arrays must not be empty"
        raise ValueError(msg)

    # Sector centres
    sector_width_deg = 360.0 / num_sectors
    sector_centres = np.arange(num_sectors, dtype=np.float64) * sector_width_deg

    # Classify and compute statistics
    sector_indices = classify_direction_sector(directions_deg, num_sectors)
    frequencies = compute_sector_frequencies(sector_indices, num_sectors)
    mean_speeds = compute_sector_mean_speed_ms(speeds_ms, sector_indices, num_sectors)
    sector_weibull = fit_sector_weibull(speeds_ms, sector_indices, num_sectors)
    energy_fractions = compute_energy_rose(frequencies, mean_speeds)

    # Dominant direction = centre of the most frequent sector
    dominant_idx = int(np.argmax(frequencies))
    dominant_direction = float(sector_centres[dominant_idx])

    # Circular statistics
    circ_std = compute_circular_std_deg(directions_deg)

    return WindRoseResult(
        sector_centres_deg=sector_centres,
        frequencies=frequencies,
        mean_speeds_ms=mean_speeds,
        sector_weibull=sector_weibull,
        energy_fractions=energy_fractions,
        dominant_direction_deg=dominant_direction,
        circular_std_deg=circ_std,
        num_sectors=num_sectors,
    )
