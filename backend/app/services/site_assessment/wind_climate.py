"""
Site wind climate from the region pack: Weibull A and k at hub height and the
12-sector direction frequency (wind FROM, sector centres 0°, 30°, …, 330°).

Data (scripts/fetch_wind_climate.py): mean speed at 150 m from the NEWA
Mesoscale Atlas, k from the NEWA Microscale Atlas (100/200 m → 150 m), and the
direction rose from ERA5 100 m hourly winds 2015–2024. Without those layers
the regional approximation is returned and labelled as such.

Physics
-------
Weibull mean: ū = A·Γ(1 + 1/k). Over a site the mean speed and k are averaged
over the interior samples and A is derived from them, so ū stays exact.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import cache

import numpy as np
from numpy.typing import NDArray

from app.services.site_assessment.layers import RegionPack

SECTORS = 12
SECTOR_BANDS = tuple(f"f{s * 30:03d}" for s in range(SECTORS))

#: Regional approximation used before the real layers existed (P1 synthetic climate).
APPROX_A_MS = 10.5
APPROX_K = 2.2
APPROX_SOURCE = (
    "Real data not found — closest approximation used: regional Weibull A 10.5 m/s, "
    "k 2.2 (P1 synthetic climate)"
)


@dataclass(frozen=True)
class WindClimate:
    """Wind climate of a site at hub height.

    Units: m/s for speeds, m for height; ``frequencies`` sum to 1 (or are None
    when no rose is available — the caller then keeps its own default rose).
    """

    mean_ms: float
    a_ms: float
    k: float
    height_m: float
    frequencies: tuple[float, ...] | None
    source: str
    license: str
    approximate: bool


def approximation() -> WindClimate:
    return WindClimate(
        mean_ms=APPROX_A_MS * math.gamma(1 + 1 / APPROX_K),
        a_ms=APPROX_A_MS,
        k=APPROX_K,
        height_m=150.0,
        frequencies=None,
        source=APPROX_SOURCE,
        license="—",
        approximate=True,
    )


def site_wind(pack: RegionPack, lon: NDArray[np.float64], lat: NDArray[np.float64]) -> WindClimate:
    """Wind climate averaged over sample points (lon, lat) of a site."""
    mean_r, k_r = pack.raster("wind", "mean"), pack.raster("wind", "k")
    if mean_r is None or k_r is None:
        return approximation()
    mean = mean_r.sample(lon, lat)
    k = k_r.sample(lon, lat)
    ok = np.isfinite(mean) & np.isfinite(k)
    if not ok.any():  # site on land or outside the grid
        return approximation()
    u, kk = float(mean[ok].mean()), float(k[ok].mean())

    freqs: tuple[float, ...] | None = None
    clon, clat = np.array([float(np.mean(lon))]), np.array([float(np.mean(lat))])
    bands = [pack.raster("wind_rose", b) for b in SECTOR_BANDS]
    if all(b is not None for b in bands):
        f = np.array([float(b.sample(clon, clat)[0]) for b in bands if b is not None])
        if np.isfinite(f).all() and f.sum() > 0:
            freqs = tuple(float(v) for v in f / f.sum())

    wind_layer = pack.by_role("wind")[0]
    rose_layer = pack.by_role("wind_rose")
    source = wind_layer.source + (f"; direction: {rose_layer[0].source}" if rose_layer else "")
    license_ = wind_layer.license + (f"; {rose_layer[0].license}" if rose_layer else "")
    height = float((wind_layer.raster or {}).get("height_m", 150.0))
    return WindClimate(
        mean_ms=u,
        a_ms=u / math.gamma(1 + 1 / kk),
        k=kk,
        height_m=height,
        frequencies=freqs,
        source=source,
        license=license_,
        approximate=False,
    )


# ── SB-510 reference site ─────────────────────────────────────────────────────

#: Hour-to-hour persistence of the SB-510 wind speed: AR(1) coefficient fitted (least
#: squares, lags 1–24 h, RMS 0.010) to the autocorrelation of the normal scores of the
#: ERA5 100 m hourly wind speed 2020–2024 at 55.06 °N 16.52 °E (Copernicus C3S via the
#: Open-Meteo archive API, CC BY 4.0; read 2026-10-08). Data: lag 1 h 0.972, 6 h 0.782,
#: 24 h 0.362. Per 10 minutes: 0.9572^(1/6) = 0.99274.
SB510_PERSISTENCE_1H = 0.9572
SB510_PERSISTENCE_SOURCE = (
    "AR(1) fit to ERA5 100 m hourly wind speed 2020–2024 at SB-510 (Copernicus C3S via the "
    "Open-Meteo archive API, CC BY 4.0)"
)


@cache
def sb510_wind() -> WindClimate:
    """Wind climate over the 34 SB-510 turbines (region pack: NEWA 150 m + ERA5 rose)."""
    from app.schemas.site_assessment import DEFAULT_REGION
    from app.services.p1.sb510_layout import SB510_TURBINES
    from app.services.site_assessment.layers import load_region

    lat = np.array([t[2] for t in SB510_TURBINES])
    lon = np.array([t[3] for t in SB510_TURBINES])
    return site_wind(load_region(DEFAULT_REGION), lon, lat)
