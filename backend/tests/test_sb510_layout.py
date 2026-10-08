"""SB-510 reference layout: backend copy == frontend map, and its site wind climate."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.p1.sb510_layout import SB510_OSS, SB510_TURBINES, centroid, local_xy_m
from app.services.p2.network_model import STRING_LAYOUT
from app.services.site_assessment.wind_climate import SB510_PERSISTENCE_1H, sb510_wind

TS = Path(__file__).resolve().parents[2] / "frontend" / "src" / "constants" / "windFarmLayout.ts"


def test_matches_the_frontend_map() -> None:
    text = TS.read_text(encoding="utf-8")
    rows = re.findall(
        r'id: "(WTG-\d\d)", stringNumber: (\d), x: [\d.]+, y: [\d.]+, lat: ([\d.]+), lon: ([\d.]+)',
        text,
    )
    assert [(r[0], int(r[1]), float(r[2]), float(r[3])) for r in rows] == list(SB510_TURBINES)
    oss = re.search(r"OSS_GEO[^=]*=\s*\{\s*lat:\s*([\d.]+),\s*lon:\s*([\d.]+)", text)
    assert oss is not None and (float(oss[1]), float(oss[2])) == SB510_OSS


def test_strings_follow_the_electrical_design() -> None:
    counts = [sum(1 for t in SB510_TURBINES if t[1] == s) for s in range(1, 7)]
    assert counts == STRING_LAYOUT


def test_projection_and_centroid() -> None:
    assert local_xy_m(*SB510_TURBINES[0][2:]) == (0.0, 0.0)
    lat, lon = centroid()
    assert 55.0 < lat < 55.1 and 16.4 < lon < 16.7  # MSP energy basin PZP_44
    # WTG-07 is the next string east, ≈ 8 D = 1.93 km
    x, _ = local_xy_m(*SB510_TURBINES[6][2:])
    assert x == pytest.approx(8 * 241.35, rel=0.03)


def test_site_wind_climate() -> None:
    """NEWA 150 m mean 9.57 m/s, k 2.04 → A 10.80 m/s; ERA5 rose peaks at 270°."""
    w = sb510_wind()
    assert not w.approximate and w.height_m == 150.0
    assert w.a_ms == pytest.approx(10.80, abs=0.02) and w.k == pytest.approx(2.04, abs=0.01)
    assert w.frequencies is not None and max(range(12), key=lambda i: w.frequencies[i]) == 9
    assert 0.95 < SB510_PERSISTENCE_1H < 0.98
