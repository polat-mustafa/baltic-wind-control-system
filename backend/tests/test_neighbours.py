"""Cluster wakes: approximate neighbour layouts and the external wake loss."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p1.wake_model import create_wind_turbine, run_cluster_wake
from app.services.site_assessment.layers import load_region
from app.services.site_assessment.neighbours import RADIUS_KM, neighbour_farms

client = TestClient(app)

SB510_SITE = [
    [16.4978, 55.099],
    [16.5452, 55.1059],
    [16.6056, 55.1083],
    [16.63, 55.1139],
    [16.63, 55.0474],
    [16.4496, 55.0054],
    [16.4417, 55.0018],
    [16.42, 54.9881],
    [16.42, 55.0688],
]


def test_sb510_neighbours() -> None:
    """Projects holding PZP_44 are the site itself; the rest within 60 km get layouts."""
    n = neighbour_farms(load_region("southern-baltic"), SB510_SITE, 15.0)
    names = [f.name for f in n.farms]
    assert not any(k in " ".join(names) for k in ("Baltica 9", "FEW Baltic II", "Sharco"))
    assert names[0] == "MFW Bałtyk II Offshore Wind Farm"  # nearest, mapped outline
    assert all(f.distance_km <= RADIUS_KM for f in n.farms)
    for f in n.farms:
        assert len(f.turbines) == pytest.approx(f.power_mw / 15.0, abs=1.0)
    baltica2 = next(f for f in n.farms if f.name == "Baltica 2")
    assert baltica2.source == "outline"  # its EMODnet point is inside the outline: not twice
    assert names.count("Baltica 2") == 1
    # density for point-only projects from the mapped outlines (≈ 8–11 MW/km² in the Baltic)
    assert 7.0 < n.density_mw_km2 < 12.0 and "outlines" in n.density_basis


def _row(x0: float, n: int = 5, spacing: float = 1200.0) -> tuple[np.ndarray, np.ndarray]:
    return x0 + spacing * np.arange(n, dtype=float), np.zeros(n)


@pytest.fixture(scope="module")
def west_wind_site():
    from py_wake.site import UniformWeibullSite

    p = np.full(12, 1e-6)
    p[9] = 1.0  # wind FROM 270° only
    return UniformWeibullSite(p_wd=p / p.sum(), a=[10.0] * 12, k=[2.0] * 12, ti=0.06)


def test_upwind_neighbours_cost_energy_downwind_ones_do_not(west_wind_site) -> None:
    wt = create_wind_turbine()
    x, y = _row(0.0)
    up_x, up_y = _row(-15_000.0)  # 15 km west = upwind
    down_x, down_y = _row(15_000.0)
    up = run_cluster_wake(x, y, up_x, up_y, west_wind_site, wt)
    down = run_cluster_wake(x, y, down_x, down_y, west_wind_site, wt)
    assert up["external_wake_loss_percent"] > 1.0
    assert abs(down["external_wake_loss_percent"]) < 0.05  # no blockage model
    assert up["alone_gwh"] == pytest.approx(down["alone_gwh"])


def test_neighbours_and_custom_wake_api() -> None:
    r = client.post("/api/v1/site/neighbours", json={"polygon": SB510_SITE, "radius_km": 30})
    assert r.status_code == 200, r.text
    body = r.json()
    assert [f["name"] for f in body["farms"]] == ["MFW Bałtyk II Offshore Wind Farm"]
    assert "not published" in body["note"]
    bad = client.post(
        "/api/v1/wind/wake-analysis-custom",
        json={"x_m": [0, 2000], "y_m": [0, 0], "neighbour_x_m": [9000], "neighbour_y_m": []},
    )
    assert bad.status_code == 422
    plain = client.post("/api/v1/wind/wake-analysis-custom", json={"x_m": [0, 2000], "y_m": [0, 0]})
    assert plain.json()["external_wake_loss_percent"] is None
    assert plain.json()["neighbour_count"] == 0
