"""
Synthetic sea-state time series for campaign planning (6-hour steps).

Each run is one possible year-to-year weather sequence at the site:

- Marginals follow the monthly climate already used by the O&M weather
  window model (``services/p1/weather_window.py``): significant wave height
  Hs is Rayleigh with the monthly mean Hs, the 10 m wind speed is Weibull
  k = 2 (Rayleigh) with the monthly mean wind speed.
- Persistence: the latent standard-normal variables are AR(1) with lag-one
  correlation ``RHO_6H`` per 6-hour step. Storms and calms therefore last for
  days, which is what makes a long operation wait much longer than the
  workable-time fraction suggests.
- Wind and waves are correlated (latent correlation ``R_WIND_WAVE``, the
  r ≈ 0.7 quoted for Baltic offshore in the O&M model).

The persistence and correlation values are illustrative teaching values,
not fitted to a hindcast; a real campaign plan uses site hindcast series
(e.g. ERA5 or CMEMS BAL-PHY-WAV) directly.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
from numpy.typing import NDArray
from scipy.signal import lfilter
from scipy.special import ndtr

from app.services.p1.weather_window import _MONTHLY_HS_P50, _MONTHLY_VW_MEAN

STEP_HOURS = 6
STEPS_PER_DAY = 24 // STEP_HOURS
RHO_6H = 0.9  # lag-one correlation per 6 h (e-folding ≈ 57 h), illustrative
R_WIND_WAVE = 0.7
HUB_HEIGHT_M = 150.0
# Normal wind profile exponent for offshore sites (IEC 61400-3-1 NWP).
SHEAR_ALPHA = 0.14

HS_MEAN = np.asarray(_MONTHLY_HS_P50, dtype=float)
VW_MEAN = np.asarray(_MONTHLY_VW_MEAN, dtype=float)


def hub_wind(v10: NDArray[np.float64]) -> NDArray[np.float64]:
    """10 m wind speed to hub height with the power law (α = SHEAR_ALPHA)."""
    return np.asarray(v10 * (HUB_HEIGHT_M / 10.0) ** SHEAR_ALPHA, dtype=float)


def step_months(start: date, steps: int) -> NDArray[np.int_]:
    """Calendar month index (0 = Jan) of every 6-hour step from ``start``."""
    days = steps // STEPS_PER_DAY + 1
    months = np.array([(start + timedelta(days=d)).month - 1 for d in range(days)], dtype=int)
    return np.repeat(months, STEPS_PER_DAY)[:steps]


def _ar1(rng: np.random.Generator, runs: int, steps: int) -> NDArray[np.float64]:
    """Stationary AR(1) standard-normal series, shape (runs, steps)."""
    eps = rng.standard_normal((runs, steps))
    z0 = rng.standard_normal((runs, 1))
    zi = RHO_6H * z0
    out, _ = lfilter([math.sqrt(1.0 - RHO_6H**2)], [1.0, -RHO_6H], eps, axis=1, zi=zi)
    return np.asarray(out)


def simulate(
    start: date, steps: int, runs: int, seed: int
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Hs [m] and 10 m wind speed [m/s], each of shape (runs, steps)."""
    rng = np.random.default_rng(seed)
    z_wave = _ar1(rng, runs, steps)
    z_wind = R_WIND_WAVE * z_wave + math.sqrt(1.0 - R_WIND_WAVE**2) * _ar1(rng, runs, steps)
    m = step_months(start, steps)
    # survival probabilities in (0, 1); clip keeps log() finite
    q_wave = np.clip(ndtr(-z_wave), 1e-12, 1.0)
    q_wind = np.clip(ndtr(-z_wind), 1e-12, 1.0)
    # Rayleigh with mean μ: P(H > x) = exp(−π/4·(x/μ)²)  →  x = μ·√(−4/π·ln q)
    hs = HS_MEAN[m] * np.sqrt(-4.0 / math.pi * np.log(q_wave))
    # Weibull k = 2 with mean μ: c = 2μ/√π, P(V > x) = exp(−(x/c)²)
    vw = (2.0 / math.sqrt(math.pi)) * VW_MEAN[m] * np.sqrt(-np.log(q_wind))
    return hs, vw


def run_lengths(ok: NDArray[np.bool_]) -> NDArray[np.int32]:
    """Consecutive workable steps starting at each step, shape (runs, steps)."""
    runs, steps = ok.shape
    out = np.zeros((runs, steps + 1), dtype=np.int32)
    for s in range(steps - 1, -1, -1):
        out[:, s] = (out[:, s + 1] + 1) * ok[:, s]
    return out[:, :steps]
