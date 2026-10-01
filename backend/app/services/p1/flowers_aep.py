"""
FLOWERS-style analytical AEP: wake losses integrated over the wind rose.

Physics
-------
A directional sweep evaluates the wake model at every wind direction and
speed. FLOWERS (LoCascio et al. 2022) instead integrates the wake deficit
analytically over the wind rose, expressed as a Fourier series, which makes
an AEP evaluation cheap enough for layout optimisation.

This module implements a simplified, pairwise version of that idea:

1. Wind rose → Fourier series of the sector frequency f(θ) (compass θ,
   "wind from"), truncated at the Nyquist mode N_sectors/2. The direction
   probability density is f(θ) / Δθ_sector [1/rad].
2. Turbine j is in the wake of i when the wind blows from the bearing of
   i seen from j. The probability of that is density(θ_ij) × angular width
   of the wake at distance r_ij:
       Jensen top-hat:  width = 2·atan((D/2 + k·r) / r)
       (the Gaussian module uses ∫δ dθ = C·√(2π)·σ / r)
3. Speed-resolved: for each 0.5 m/s bin with Weibull(A, k) probability, the
   power lost at j is Σ_i p_ij·[P(v) − P(v·(1 − δ_ij(v)))], capped at P(v).
   Above rated a small deficit costs nothing — the power curve handles it.
4. Gross AEP = 8760 h · Σ_v P(v)·p(v) per turbine — never P(v̄)·8760, which
   misstates energy because P(v) is non-linear (Jensen's inequality).

Pairwise superposition ignores wake-on-wake shadowing, so it is a screening
estimate; compare it with the PyWake directional sweep on the AEP tab.

References
----------
- LoCascio, M.J. et al. (2022). FLOWERS: an integral approach to engineering
  wake models. Wind Energy Science 7, 1137–1151.
- Jensen, N.O. (1983). A note on wind generator interaction. Risø-M-2411.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    RATED_POWER_KW,
    ROTOR_DIAMETER_M,
    get_v236_ct_curve,
    get_v236_power_curve_kw,
)

# ── FLOWERS Constants ───────────────────────────────────────────

WAKE_EXPANSION_COEFFICIENT: float = 0.04
"""Jensen wake expansion coefficient k for offshore conditions [-]."""

N_FOURIER_MODES: int = 12
"""Requested Fourier modes (truncated to N_sectors/2 — the Nyquist limit)."""

Array = NDArray[np.floating]
DeficitFn = Callable[[Array, Array], tuple[Array, Array]]


@dataclass(frozen=True)
class FLOWERSResult:
    """Result of FLOWERS analytical AEP estimation.

    Attributes
    ----------
    aep_gwh : float
        Net (waked) annual energy production [GWh/year].
    gross_aep_gwh : float
        Gross AEP without wake losses [GWh/year].
    wake_loss_percent : float
        Wake loss [%].
    computation_time_ms : float
        Computation time [milliseconds].
    n_fourier_modes : int
        Fourier modes actually used.
    capacity_factor : float
        Net capacity factor [-].
    per_turbine_aep_gwh : NDArray
        Per-turbine net AEP [GWh/year].
    """

    aep_gwh: float
    gross_aep_gwh: float
    wake_loss_percent: float
    computation_time_ms: float
    n_fourier_modes: int
    capacity_factor: float
    per_turbine_aep_gwh: Array


def _fourier_decompose_wind_rose(
    frequencies: Array,
    directions_rad: Array,
    n_modes: int = N_FOURIER_MODES,
) -> tuple[float, Array, Array]:
    """Decompose the sector-frequency rose into a Fourier series.

    f(θ) = a_0 + Σ_n (a_n cos(nθ) + b_n sin(nθ)), f in "fraction per sector".
    """
    n_sectors = len(frequencies)
    a_0 = float(np.mean(frequencies))
    a_n = np.zeros(n_modes)
    b_n = np.zeros(n_modes)
    for n in range(1, n_modes + 1):
        a_n[n - 1] = 2.0 / n_sectors * np.sum(frequencies * np.cos(n * directions_rad))
        b_n[n - 1] = 2.0 / n_sectors * np.sum(frequencies * np.sin(n * directions_rad))
    return a_0, a_n, b_n


def weibull_bins(
    mean_wind_speed_ms: float, weibull_k: float, dv: float = 0.5
) -> tuple[Array, Array]:
    """Bin centres [m/s] and probabilities for Weibull(A, k), A = v̄ / Γ(1+1/k)."""
    a = mean_wind_speed_ms / math.gamma(1.0 + 1.0 / weibull_k)
    edges = np.arange(0.0, 35.0 + dv, dv)
    cdf = 1.0 - np.exp(-((edges / a) ** weibull_k))
    return (edges[:-1] + edges[1:]) / 2.0, np.diff(cdf)


def rose_aep(
    x_positions_m: Array,
    y_positions_m: Array,
    deficit_and_width: DeficitFn,
    sector_frequencies: Array | None,
    sector_directions_deg: Array | None,
    mean_wind_speed_ms: float,
    weibull_k: float,
    n_fourier_modes: int,
) -> tuple[float, Array, int]:
    """Shared FLOWERS-style integration (see module docstring).

    ``deficit_and_width(r_m[n,n,1], ct[1,1,nv])`` returns the centre-line
    velocity deficit δ and the angular width [rad] over which it applies.
    Returns (gross AEP per turbine [GWh], net AEP per turbine [GWh], modes used).
    """
    if sector_frequencies is None:
        sector_frequencies = np.ones(12) / 12.0
    n_sectors = len(sector_frequencies)
    if sector_directions_deg is None:
        sector_directions_deg = np.arange(n_sectors) * 360.0 / n_sectors
    modes_used = min(n_fourier_modes, n_sectors // 2)
    a_0, a_n, b_n = _fourier_decompose_wind_rose(
        np.asarray(sector_frequencies, dtype=float),
        np.radians(np.asarray(sector_directions_deg, dtype=float)),
        modes_used,
    )

    v, p_v = weibull_bins(mean_wind_speed_ms, weibull_k)
    power = get_v236_power_curve_kw(v)  # [kW]
    ct = get_v236_ct_curve(v)

    # Pair geometry: i upstream (rows) → j downstream (columns)
    dx = x_positions_m[None, :] - x_positions_m[:, None]
    dy = y_positions_m[None, :] - y_positions_m[:, None]
    r = np.hypot(dx, dy)
    # Wind must come FROM the bearing of i as seen from j (compass: atan2(east, north))
    theta = np.arctan2(-dx, -dy)
    m = np.arange(1, modes_used + 1)[:, None, None]
    f = a_0 + np.sum(
        a_n[:, None, None] * np.cos(m * theta) + b_n[:, None, None] * np.sin(m * theta), axis=0
    )
    density = np.clip(f, 0.0, None) / (2.0 * math.pi / n_sectors)  # [1/rad]

    deficit, width = deficit_and_width(r[:, :, None], ct[None, None, :])
    prob = np.clip(density[:, :, None] * width, 0.0, 1.0)
    prob[r < ROTOR_DIAMETER_M] = 0.0  # self-pairs / overlapping positions

    lost = power[None, None, :] - get_v236_power_curve_kw(v[None, None, :] * (1.0 - deficit))
    loss_j = np.minimum((prob * lost).sum(axis=0), power[None, :])  # [n, nv]

    gross = float(np.sum(power * p_v)) * 8760.0 / 1e6  # GWh per turbine
    net = np.sum((power[None, :] - loss_j) * p_v[None, :], axis=1) * 8760.0 / 1e6
    return gross, net, modes_used


def _jensen(r: Array, ct: Array) -> tuple[Array, Array]:
    """Jensen top-hat deficit and wake-cone angular width [rad]."""
    k, d = WAKE_EXPANSION_COEFFICIENT, ROTOR_DIAMETER_M
    rs = np.maximum(r, 1.0)
    deficit = (1.0 - np.sqrt(1.0 - np.clip(ct, 0.0, 0.999))) / (1.0 + 2.0 * k * rs / d) ** 2
    return deficit, 2.0 * np.arctan((d / 2.0 + k * rs) / rs)


def summarise(gross_t: float, net_t: Array, modes: int, t0: float) -> FLOWERSResult:
    """Farm totals, wake loss and capacity factor from per-turbine values."""
    n = len(net_t)
    total_gross = gross_t * n
    total_net = float(net_t.sum())
    return FLOWERSResult(
        aep_gwh=round(total_net, 2),
        gross_aep_gwh=round(total_gross, 2),
        wake_loss_percent=round((1.0 - total_net / total_gross) * 100.0, 2),
        computation_time_ms=round((time.perf_counter() - t0) * 1000.0, 1),
        n_fourier_modes=modes,
        capacity_factor=round(total_net / (RATED_POWER_KW * 1e-6 * 8760.0 * n), 4),
        per_turbine_aep_gwh=np.round(net_t, 3),
    )


def compute_flowers_aep(
    x_positions_m: Array,
    y_positions_m: Array,
    sector_frequencies: Array | None = None,
    sector_directions_deg: Array | None = None,
    mean_wind_speed_ms: float = 9.3,
    n_fourier_modes: int = N_FOURIER_MODES,
    weibull_k: float = 2.2,
) -> FLOWERSResult:
    """AEP by FLOWERS-style rose integration with the Jensen wake model."""
    t0 = time.perf_counter()
    gross_t, net_t, modes = rose_aep(
        x_positions_m,
        y_positions_m,
        _jensen,
        sector_frequencies,
        sector_directions_deg,
        mean_wind_speed_ms,
        weibull_k,
        n_fourier_modes,
    )
    return summarise(gross_t, net_t, modes, t0)
