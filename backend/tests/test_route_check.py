"""Export cable route check (/api/v1/site/route-check)."""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.site_assessment.layers import load_region, parse_pack
from app.services.site_assessment.route_check import RouteError, auto_route, check_route

client = TestClient(app)

#: SB-510's surveyed export route (frontend constants/windFarmLayout.ts EXPORT_CABLE_GEO):
#: OSS → round the west end of Ławica Słupska → across PZP_15 → landfall Zaleskie → onshore.
SB510_ROUTE = [
    [16.442, 55.026],
    [16.335, 54.93],
    [16.37, 54.855],
    [16.395, 54.745],
    [16.69, 54.615],
    [16.735, 54.5698],
    [16.742, 54.55],
    [16.76, 54.53],
    [16.79, 54.516],
    [16.825, 54.51],
    [16.85, 54.498],
    [16.872, 54.506],
]


def test_sb510_route_is_76_5_km_and_crosses_pzp15_at_right_angles() -> None:
    r = check_route(load_region("southern-baltic"), SB510_ROUTE)
    assert r.total_km == pytest.approx(76.5, abs=0.3)  # network_model.EXPORT_CABLE_LENGTH_KM
    assert r.offshore_km == pytest.approx(63.3, abs=0.5)
    assert r.onshore_km == pytest.approx(13.2, abs=0.5)
    assert r.landfall is not None
    assert r.landfall == pytest.approx((16.735, 54.5698), abs=0.01)  # Zaleskie
    pzp15 = [c for c in r.shipping if c.name.startswith("PZP_15")]
    assert len(pzp15) == 2 and all(c.angle_deg > 85 for c in pzp15)
    assert r.cables == []
    names = {a.name for a in r.natura}
    assert not any("Ławica Słupska" in n for n in names)  # round its west end
    assert any("PLB990002" in n for n in names)  # the coastal bird area spans the whole coast
    status = {c.id: c.status for c in r.checks}
    assert status["landfall"] == "info" and status["cables"] == "pass"
    assert status["shipping"] == "info"  # every crossing ≥ 45°


def _pack_with_cable(angle_deg: float):
    """1° box: sea north of 54.0, a north–south cable at 16.5 °E rotated by ``angle_deg``."""
    # projected plane: km east = Δlon · cos φ0 (φ0 = 54.45 °N, the bbox centre)
    dx = (
        0.15 / math.tan(math.radians(angle_deg)) / math.cos(math.radians(54.45))
        if angle_deg < 90
        else 0.0
    )

    def layer(id_: str, role: str, geometry: str, features: list[dict]) -> dict:  # type: ignore[type-arg]
        return {
            "id": id_,
            "title": id_,
            "role": role,
            "geometry": geometry,
            "source": "t",
            "license": "t",
            "retrieved": "t",
            "features": features,
        }

    sea = [[16.0, 54.0], [17.0, 54.0], [17.0, 55.0], [16.0, 55.0], [16.0, 54.0]]
    return parse_pack(
        {
            "region": "t",
            "title": "t",
            "bbox": [16.0, 53.9, 17.0, 55.0],
            "pending": [],
            "layers": [
                layer("sea", "sea", "polygon", [{"name": "sea", "coordinates": [sea]}]),
                layer(
                    "cable",
                    "cable",
                    "line",
                    [
                        {
                            "name": "Test cable",
                            "coordinates": [[16.5 - dx, 54.35], [16.5 + dx, 54.65]],
                        }
                    ],
                ),
            ],
        }
    )


@pytest.mark.parametrize(("angle", "status"), [(90.0, "info"), (60.0, "info"), (30.0, "warn")])
def test_cable_crossing_angle_and_icpc_floor(angle: float, status: str) -> None:
    route = [[16.2, 54.5], [16.8, 54.5], [16.8, 53.95]]  # east at sea, then south onto land
    r = check_route(_pack_with_cable(angle), route)
    assert len(r.cables) == 1
    assert r.cables[0].angle_deg == pytest.approx(angle, abs=0.5)
    assert {c.id: c.status for c in r.checks}["cables"] == status
    assert r.landfall is not None and r.landfall[1] == pytest.approx(54.0, abs=0.01)


def test_route_needs_a_landfall_and_the_region() -> None:
    at_sea = check_route(_pack_with_cable(90.0), [[16.2, 54.5], [16.4, 54.5]])
    assert {c.id: c.status for c in at_sea.checks}["landfall"] == "fail"
    with pytest.raises(RouteError, match="inside the region"):
        check_route(_pack_with_cable(90.0), [[10.0, 54.5], [16.4, 54.5]])


def test_auto_route_runs_by_sea_to_the_grid_node() -> None:
    pack = load_region("southern-baltic")
    node = next(n for n in pack.points("grid") if n[0].startswith("Słupsk"))
    route = auto_route(pack, (16.442, 55.026), (node[1], node[2]))
    assert route[0] == [16.442, 55.026] and route[-1] == [node[1], node[2]]
    r = check_route(pack, route, auto=True)
    assert r.landfall is not None
    # shorter than the surveyed route, which detours round the Natura 2000 bank
    assert 55 < r.total_km < 76.5
    assert r.auto


def test_route_check_api() -> None:
    r = client.post("/api/v1/site/route-check", json={"route": SB510_ROUTE})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["auto"] is False and body["total_km"] == pytest.approx(76.5, abs=0.3)
    auto = client.post(
        "/api/v1/site/route-check",
        json={"start": [16.442, 55.026], "grid_node": "Słupsk Wierzbięcin 400/110 kV"},
    ).json()
    assert auto["auto"] is True and auto["grid_node"] == "Słupsk Wierzbięcin 400/110 kV"
    assert client.post("/api/v1/site/route-check", json={}).status_code == 422
    bad = client.post(
        "/api/v1/site/route-check", json={"start": [16.44, 55.03], "grid_node": "Nowhere"}
    )
    assert bad.status_code == 422
