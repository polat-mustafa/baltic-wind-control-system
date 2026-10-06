"""Site wind climate from the region pack (NEWA mean + k, ERA5 rose) and its fallback."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pytest

from app.services.site_assessment.layers import load_region, parse_pack
from app.services.site_assessment.wind_climate import (
    APPROX_A_MS,
    APPROX_K,
    SECTOR_BANDS,
    approximation,
    site_wind,
)


def _pack(with_wind: bool = True, with_rose: bool = True) -> Any:
    """1°×1° grid: mean speed grows 1 m/s per degree east, k = 2.0, all wind from the west."""
    lons = np.arange(16.0, 17.0001, 0.5)
    lats = np.arange(54.0, 55.0001, 0.5)
    mean = [[9.0 + (lo - 16.0) for lo in lons] for _ in lats]
    k = [[2.0 for _ in lons] for _ in lats]
    a = [[m / math.gamma(1.5) for m in row] for row in mean]
    layers: list[dict[str, Any]] = []
    base = {"source": "test", "license": "test", "retrieved": "2026-01-01", "features": []}
    if with_wind:
        layers.append(
            {
                "id": "wind_climate",
                "title": "wind",
                "role": "wind",
                "geometry": "raster",
                **base,
                "raster": {
                    "lon0": 16.0,
                    "lat0": 54.0,
                    "dlon": 0.5,
                    "dlat": 0.5,
                    "height_m": 150,
                    "bands": {"mean": mean, "k": k, "A": a},
                },
            }
        )
    if with_rose:
        west = {b: [[1.0 if b == "f270" else 0.0] * 3] * 3 for b in SECTOR_BANDS}
        layers.append(
            {
                "id": "wind_rose",
                "title": "rose",
                "role": "wind_rose",
                "geometry": "raster",
                **base,
                "raster": {"lon0": 16.0, "lat0": 54.0, "dlon": 0.5, "dlat": 0.5, "bands": west},
            }
        )
    return parse_pack(
        {"region": "t", "title": "t", "bbox": [16, 54, 17, 55], "layers": layers, "pending": []}
    )


def test_site_average_and_weibull_mean() -> None:
    lon = np.array([16.25, 16.75])
    lat = np.array([54.5, 54.5])
    w = site_wind(_pack(), lon, lat)
    assert not w.approximate
    assert w.mean_ms == pytest.approx(9.5)  # 9.25 and 9.75 m/s
    assert w.k == pytest.approx(2.0)
    assert w.a_ms * math.gamma(1 + 1 / w.k) == pytest.approx(w.mean_ms)  # ū = A·Γ(1 + 1/k)
    assert w.height_m == 150.0
    assert w.frequencies is not None and w.frequencies[9] == pytest.approx(1.0)
    assert sum(w.frequencies) == pytest.approx(1.0)


def test_without_rose_frequencies_are_none() -> None:
    w = site_wind(_pack(with_rose=False), np.array([16.5]), np.array([54.5]))
    assert w.frequencies is None and not w.approximate


def test_fallback_is_labelled() -> None:
    w = site_wind(_pack(with_wind=False), np.array([16.5]), np.array([54.5]))
    assert w == approximation()
    assert w.approximate and "Real data not found" in w.source
    assert (w.a_ms, w.k) == (APPROX_A_MS, APPROX_K)
    # outside the grid → fallback too
    assert site_wind(_pack(), np.array([18.0]), np.array([54.5])).approximate


def test_region_pack_wind_is_plausible() -> None:
    """Real pack: offshore 150 m means of the southern Baltic are ≈ 9–10 m/s, k ≈ 2."""
    pack = load_region("southern-baltic")
    if not pack.has("wind"):
        pytest.skip("wind climate not packaged")
    w = site_wind(pack, np.array([16.4]), np.array([54.8]))  # SB-510
    assert not w.approximate
    assert 9.0 < w.mean_ms < 10.0
    assert 1.8 < w.k < 2.4
    assert w.frequencies is not None
    # prevailing westerlies: SW–W–NW (210°–300°) hold more than a third of the hours
    assert sum(w.frequencies[7:11]) > 0.35
    for layer in pack.by_role("wind") + pack.by_role("wind_rose"):
        assert layer.source and layer.license and layer.retrieved
    assert "NC" in pack.by_role("wind")[0].license  # NEWA is non-commercial
