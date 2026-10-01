"""
Gaussian FLOWERS-style AEP — rose integration with a Gaussian wake.

Same rose integration as flowers_aep (see that module), with the
Bastankhah–Porté-Agel (2014) Gaussian deficit instead of Jensen's top-hat:

    ΔU/U∞ = C(x) · exp(−y² / (2σ²)),   σ = k*·x + ε₀,   ε₀ = D/√8
    C(x)  = 1 − √(1 − Ct / (8 (σ/D)²))

Integrating over wind direction (lateral offset y = r·θ for small θ) has a
closed form:  ∫ δ dθ = C(r) · √(2π) · σ(r) / r  — so the Gaussian wake acts
like a top-hat of centre-line depth C and angular width √(2π)·σ/r.

References
----------
- Bastankhah, M. & Porté-Agel, F. (2014). A new analytical model for wind
  turbine wakes. Renewable Energy 70, 116–123.
- LoCascio, M.J. et al. (2022). FLOWERS: an integral approach to engineering
  wake models. Wind Energy Science 7, 1137–1151.

Validation (34 × V236, A = 10.5 m/s, k = 2.2): gross AEP within 0.5 % of the
PyWake sweep; wake loss 5.5 % vs PyWake (Niayifar, linear sum, STF2017) 5.6 %.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p1.flowers_aep import (
    N_FOURIER_MODES,
    compute_flowers_aep,
    rose_aep,
    summarise,
)
from app.services.p1.wake_model import ROTOR_DIAMETER_M

# ── Gaussian FLOWERS Constants ─────────────────────────────────

AMBIENT_TI: float = 0.06
GAUSSIAN_K_STAR: float = 0.38 * AMBIENT_TI + 0.004
"""Wake expansion k* = 0.38·TI + 0.004 ≈ 0.027 — the ambient value of PyWake's
NiayifarGaussianDeficit used on the AEP tab (no wake-added turbulence here)."""

INITIAL_WAKE_WIDTH_FACTOR: float = 1.0 / math.sqrt(8.0)
"""ε₀/D = 1/√8 ≈ 0.354 — initial Gaussian wake width as fraction of D."""

Array = NDArray[np.floating]


@dataclass(frozen=True)
class GaussianFLOWERSResult:
    """Result of Gaussian FLOWERS analytical AEP estimation.

    Attributes
    ----------
    aep_gwh : float
        Net AEP with Gaussian wakes [GWh/year].
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
    jensen_comparison_aep_gwh : float
        AEP from Jensen FLOWERS for comparison [GWh/year].
    gaussian_vs_jensen_diff_percent : float
        Difference between Gaussian and Jensen FLOWERS [%].
    """

    aep_gwh: float
    gross_aep_gwh: float
    wake_loss_percent: float
    computation_time_ms: float
    n_fourier_modes: int
    capacity_factor: float
    per_turbine_aep_gwh: Array
    jensen_comparison_aep_gwh: float
    gaussian_vs_jensen_diff_percent: float


def _gaussian_wake_deficit(
    x_downstream_m: float,
    r_lateral_m: float,
    ct: float,
    rotor_d: float = ROTOR_DIAMETER_M,
    k_star: float = GAUSSIAN_K_STAR,
) -> float:
    """Bastankhah–Porté-Agel Gaussian velocity deficit ΔU/U∞ at a point [-]."""
    if x_downstream_m <= 0:
        return 0.0
    sigma = k_star * x_downstream_m + INITIAL_WAKE_WIDTH_FACTOR * rotor_d
    radicand = 1.0 - ct / (8.0 * (sigma / rotor_d) ** 2)
    c_x = 1.0 if radicand <= 0 else 1.0 - math.sqrt(radicand)
    return max(0.0, min(1.0, c_x * math.exp(-0.5 * (r_lateral_m / sigma) ** 2)))


def _gaussian(r: Array, ct: Array) -> tuple[Array, Array]:
    """BPA centre-line deficit and equivalent angular width √(2π)·σ/r [rad]."""
    d = ROTOR_DIAMETER_M
    rs = np.maximum(r, 1.0)
    sigma = GAUSSIAN_K_STAR * rs + INITIAL_WAKE_WIDTH_FACTOR * d
    radicand = 1.0 - ct / (8.0 * (sigma / d) ** 2)
    c_x = np.where(radicand <= 0, 1.0, 1.0 - np.sqrt(np.clip(radicand, 0.0, None)))
    return c_x, math.sqrt(2.0 * math.pi) * sigma / rs


def compute_gaussian_flowers_aep(
    x_positions_m: Array,
    y_positions_m: Array,
    sector_frequencies: Array | None = None,
    sector_directions_deg: Array | None = None,
    mean_wind_speed_ms: float = 9.3,
    n_fourier_modes: int = N_FOURIER_MODES,
    weibull_k: float = 2.2,
) -> GaussianFLOWERSResult:
    """AEP by rose integration with the Gaussian wake, plus the Jensen figure."""
    t0 = time.perf_counter()
    gross_t, net_t, modes = rose_aep(
        x_positions_m,
        y_positions_m,
        _gaussian,
        sector_frequencies,
        sector_directions_deg,
        mean_wind_speed_ms,
        weibull_k,
        n_fourier_modes,
    )
    g = summarise(gross_t, net_t, modes, t0)
    jensen = compute_flowers_aep(
        x_positions_m,
        y_positions_m,
        sector_frequencies,
        sector_directions_deg,
        mean_wind_speed_ms,
        n_fourier_modes,
        weibull_k=weibull_k,
    )
    return GaussianFLOWERSResult(
        aep_gwh=g.aep_gwh,
        gross_aep_gwh=g.gross_aep_gwh,
        wake_loss_percent=g.wake_loss_percent,
        computation_time_ms=g.computation_time_ms,
        n_fourier_modes=g.n_fourier_modes,
        capacity_factor=g.capacity_factor,
        per_turbine_aep_gwh=g.per_turbine_aep_gwh,
        jensen_comparison_aep_gwh=jensen.aep_gwh,
        gaussian_vs_jensen_diff_percent=round(
            (g.aep_gwh - jensen.aep_gwh) / jensen.aep_gwh * 100.0, 2
        ),
    )
