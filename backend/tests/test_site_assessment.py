"""Site assessment: geometry, screening rules, candidate-site reports and API.

Rules checked here (see app/services/site_assessment):
  * a point inside a Natura 2000 site, a shipping route or another wind
    farm area is never suitable;
  * the territorial sea (12 nm) is excluded for the Polish case study;
  * a missing layer is reported as "unknown", never as a silent pass;
  * the SB-510 site boundary reproduces the case study (≈ 112 km², ≈ 505 MW).
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.site_assessment.assess import InvalidSiteError, assess_site
from app.services.site_assessment.criteria import Criteria, depth_band
from app.services.site_assessment.geo import (
    EARTH_RADIUS_KM,
    LocalProjection,
    distance_to_polygons,
    distance_to_polyline,
    is_simple,
    points_in_polygon,
    points_in_polygons,
    polygon_area_km2,
)
from app.services.site_assessment.layers import load_region, parse_pack
from app.services.site_assessment.suitability import (
    CLASS_EXCLUDED,
    CLASS_MARGINAL,
    CLASS_SUITABLE,
    REASONS,
    evaluate,
    is_complete,
    ramp,
    screen,
)

client = TestClient(app)
API = "/api/v1/site"

SQUARE = np.array([[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]])
SB510_SITE = [[16.31, 54.845], [16.485, 54.845], [16.485, 54.755], [16.31, 54.755]]


# ── Synthetic region with every layer role ───────────────────────


def _box(lon0: float, lat0: float, lon1: float, lat1: float) -> list[list[list[float]]]:
    return [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]]


def synthetic_pack(**drop: bool) -> Any:
    """1°×1° box: coast along lat 54.0, sea north of it, one of each feature."""

    def layer(
        id_: str, role: str, geometry: str, features: list[dict[str, Any]], **extra: Any
    ) -> dict[str, Any]:
        return {
            "id": id_,
            "title": id_,
            "role": role,
            "geometry": geometry,
            "source": "test",
            "license": "test",
            "retrieved": "2026-01-01",
            "features": features,
            **extra,
        }

    # depth grows 1 m per 0.01° north of the coast: 0 m at 54.0, 100 m at 55.0
    lats = np.arange(54.0, 55.0001, 0.05)
    depth_rows = [[float((la - 54.0) * 100.0)] * 21 for la in lats]
    layers = [
        layer(
            "sea", "sea", "polygon", [{"name": "sea", "coordinates": _box(16.0, 54.0, 17.0, 55.5)}]
        ),
        layer(
            "shore",
            "shore",
            "line",
            [{"name": "coast", "coordinates": [[15.5, 54.0], [17.5, 54.0]]}],
        ),
        layer("grid", "grid", "point", [{"name": "node", "coordinates": [16.5, 53.9]}]),
        layer(
            "cable",
            "cable",
            "line",
            [{"name": "cable", "coordinates": [[16.9, 54.0], [16.9, 55.0]]}],
        ),
        layer(
            "owf", "owf", "polygon", [{"name": "farm", "coordinates": _box(16.7, 54.5, 16.8, 54.6)}]
        ),
        layer(
            "protected",
            "protected",
            "polygon",
            [{"name": "N2000", "coordinates": _box(16.1, 54.5, 16.2, 54.6)}],
        ),
        layer(
            "shipping",
            "shipping",
            "polygon",
            [{"name": "lane", "coordinates": _box(16.0, 54.8, 17.0, 54.85)}],
        ),
        layer(
            "depth",
            "bathymetry",
            "raster",
            [],
            raster={"lon0": 16.0, "lat0": 54.0, "dlon": 0.05, "dlat": 0.05, "values": depth_rows},
        ),
    ]
    layers = [lyr for lyr in layers if not drop.get(lyr["role"], False)]
    return parse_pack(
        {
            "region": "test",
            "title": "Test",
            "bbox": [16.0, 53.9, 17.0, 55.0],
            "layers": layers,
            "pending": [],
        }
    )


# ── Geometry ─────────────────────────────────────────────────────


class TestGeometry:
    def test_projection_scale_and_round_trip(self) -> None:
        p = LocalProjection(16.0, 54.8)
        assert p.ky == pytest.approx(EARTH_RADIUS_KM * math.pi / 180, rel=1e-12)
        assert p.ky == pytest.approx(111.19, abs=0.01)  # km per degree latitude
        assert p.kx == pytest.approx(p.ky * math.cos(math.radians(54.8)), rel=1e-12)
        x, y = p.forward(np.array([16.3]), np.array([55.0]))
        lon, lat = p.inverse(x, y)
        assert lon[0] == pytest.approx(16.3) and lat[0] == pytest.approx(55.0)

    def test_point_in_polygon(self) -> None:
        inside = points_in_polygon(
            np.array([5.0, 15.0, -1.0, 9.9]), np.array([5.0, 5.0, 5.0, 9.9]), SQUARE
        )
        assert inside.tolist() == [True, False, False, True]

    def test_concave_polygon_and_hole(self) -> None:
        u_shape = np.array(
            [[0, 0], [9, 0], [9, 9], [6, 9], [6, 3], [3, 3], [3, 9], [0, 9], [0, 0]], dtype=float
        )
        assert points_in_polygon(np.array([4.5]), np.array([6.0]), u_shape).tolist() == [False]
        assert points_in_polygon(np.array([1.5]), np.array([6.0]), u_shape).tolist() == [True]
        hole = np.array([[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]], dtype=float)
        res = points_in_polygons(np.array([5.0, 2.0]), np.array([5.0, 2.0]), [[SQUARE, hole]])
        assert res.tolist() == [False, True]

    def test_distances(self) -> None:
        line = np.array([[0.0, 0.0], [10.0, 0.0]])
        d = distance_to_polyline(np.array([5.0, -3.0, 13.0]), np.array([4.0, 0.0, 4.0]), line)
        assert d == pytest.approx([4.0, 3.0, 5.0])
        d_poly = distance_to_polygons(np.array([5.0, 13.0]), np.array([5.0, 5.0]), [[SQUARE]])
        assert d_poly == pytest.approx([0.0, 3.0])

    def test_area_and_simplicity(self) -> None:
        assert polygon_area_km2(SQUARE) == pytest.approx(100.0)
        assert polygon_area_km2(SQUARE[::-1]) == pytest.approx(100.0)
        bow_tie = np.array([[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]], dtype=float)
        assert is_simple(SQUARE) and not is_simple(bow_tie)

    def test_one_degree_cell_area(self) -> None:
        """1° × 1° at ≈ 54.5° N ≈ 111.19 km × 64.5 km (spherical reference ≈ 7176 km²)."""
        p = LocalProjection(16.5, 54.5)
        ring = p.ring(_box(16.0, 54.0, 17.0, 55.0)[0])
        exact = (
            (math.pi / 180)
            * EARTH_RADIUS_KM**2
            * (math.sin(math.radians(55)) - math.sin(math.radians(54)))
        )
        assert polygon_area_km2(ring) == pytest.approx(exact, rel=0.002)


# ── Screening rules ──────────────────────────────────────────────


class TestScreening:
    def test_hard_exclusions(self) -> None:
        pack = synthetic_pack()
        crit = Criteria(exclude_territorial_sea=False)
        lon = np.array([16.15, 16.75, 16.5, 16.9, 16.5, 16.5])
        lat = np.array([54.55, 54.55, 54.82, 54.5, 53.95, 54.05])
        ev = evaluate(pack, crit, lon, lat)
        reasons = [REASONS[r] if r >= 0 else None for r in ev.reason]
        assert reasons == [
            "protected",
            "owf_area",
            "shipping",
            "cable_buffer",
            "land",
            "too_shallow",
        ]
        assert (ev.cls == CLASS_EXCLUDED).all()

    @pytest.mark.parametrize(
        "role,box",
        [("protected", (16.1, 54.5, 16.2, 54.6)), ("shipping", (16.0, 54.8, 17.0, 54.85))],
    )
    def test_never_suitable_inside_protected_or_shipping(
        self, role: str, box: tuple[float, ...]
    ) -> None:
        rng = np.random.default_rng(7)
        lon = rng.uniform(box[0] + 1e-4, box[2] - 1e-4, 500)
        lat = rng.uniform(box[1] + 1e-4, box[3] - 1e-4, 500)
        ev = evaluate(synthetic_pack(), Criteria(exclude_territorial_sea=False), lon, lat)
        assert (ev.cls == CLASS_EXCLUDED).all()
        assert ev.excluded[role].all()

    def test_territorial_sea_from_shore_distance(self) -> None:
        pack = synthetic_pack()
        # 12 nm = 22.224 km ≈ 0.1999° of latitude north of the coast at 54.0
        lat = np.array([54.19, 54.21])
        ev = evaluate(pack, Criteria(), np.array([16.5, 16.5]), lat)
        assert ev.excluded["territorial_sea"].tolist() == [True, False]
        ev_off = evaluate(
            pack, Criteria(exclude_territorial_sea=False), np.array([16.5]), np.array([54.19])
        )
        assert not ev_off.excluded["territorial_sea"].any()

    def test_scores_and_classes(self) -> None:
        assert ramp(np.array([10.0, 30.0, 65.0, 100.0, 150.0]), 30.0, 100.0) == pytest.approx(
            [1.0, 1.0, 0.5, 0.0, 0.0]
        )
        assert depth_band(35.0).foundation.startswith("monopile")  # type: ignore[union-attr]
        assert depth_band(80.0).foundation == "floating"  # type: ignore[union-attr]
        assert depth_band(5.0) is None
        pack = synthetic_pack()
        ev = evaluate(
            pack, Criteria(exclude_territorial_sea=False), np.array([16.5]), np.array([54.35])
        )
        # depth 35 m → 1.0; shore 38.9 km; grid 50.0 km
        assert ev.depth_m[0] == pytest.approx(35.0, abs=1e-6)
        assert ev.scores["depth"][0] == 1.0
        shore = ramp(ev.shore_km, 22.224, 100.0)[0]
        grid = ramp(ev.grid_km, 30.0, 150.0)[0]
        assert ev.score[0] == pytest.approx(0.4 * 1.0 + 0.3 * shore + 0.3 * grid)
        assert ev.cls[0] == CLASS_SUITABLE

    def test_weights_renormalise_without_depth_data(self) -> None:
        pack = synthetic_pack(bathymetry=True)
        ev = evaluate(
            pack, Criteria(exclude_territorial_sea=False), np.array([16.5]), np.array([54.35])
        )
        assert math.isnan(ev.scores["depth"][0])
        expected = (0.3 * ev.scores["shore"][0] + 0.3 * ev.scores["grid"][0]) / 0.6
        assert ev.score[0] == pytest.approx(expected)

    def test_class_thresholds_follow_criteria(self) -> None:
        pack = synthetic_pack()
        lon, lat = np.array([16.5]), np.array([54.35])
        strict = evaluate(
            pack, Criteria(exclude_territorial_sea=False, suitable_score=0.99), lon, lat
        )
        assert strict.cls[0] == CLASS_MARGINAL

    def test_grid_screen_shape_and_limits(self) -> None:
        g = screen(synthetic_pack(), Criteria(), cell_km=5.0)
        assert g.evaluation.cls.shape == (g.ny, g.nx)
        assert g.nx == math.ceil(1.0 / (5.0 / LocalProjection(16.5, 54.45).kx))
        with pytest.raises(ValueError):
            screen(synthetic_pack(), Criteria(), cell_km=0.1)

    def test_completeness(self) -> None:
        assert is_complete(synthetic_pack())
        assert not is_complete(synthetic_pack(protected=True))


# ── Candidate site ───────────────────────────────────────────────


class TestAssess:
    def test_sb510_case_study(self) -> None:
        """SB-510 against the open data: geometry checks out, the site conflicts with the MSP.

        27 of the 34 fictional turbines lie in basin PZP_15, whose priority use in the
        Polish maritime spatial plan (Dz.U. 2021 poz. 935) is shipping; the Ławica
        Słupska Natura 2000 site is ≈ 1 km north. Both are real findings, kept on purpose.
        """
        pack = load_region("southern-baltic")
        a = assess_site(pack, Criteria(), SB510_SITE)
        # 0.09° × 0.175° at 54.8° N ≈ 10.0 km × 11.2 km
        assert a.area_km2 == pytest.approx(112.3, rel=0.01)
        assert a.shore_km is not None and a.shore_km[0] > 22.224  # beyond 12 nm
        assert a.grid_node is not None and "Słupsk" in a.grid_node
        assert 40 < a.grid_km < 50  # type: ignore[operator]  # export route is 44.9 km
        assert a.depth_m is not None and a.depth_m[0] > 20 and a.depth_m[1] < 45  # EMODnet DTM
        assert a.foundation == "monopile / jacket"
        assert 0.6 < a.exclusion_shares["shipping"] < 0.8
        assert a.capacity_mw == pytest.approx(a.area_km2 * (1 - a.excluded_fraction) * 4.5)
        status = {c.id: c.status for c in a.checks}
        assert status["territorial_sea"] == "pass" and status["eez"] == "pass"
        assert (
            status["owf"] == "pass" and status["depth"] == "pass" and status["restricted"] == "pass"
        )
        assert status["shipping"] == "fail"
        assert status["natura2000"] == "warn"
        assert a.protected_km is not None and 0 < a.protected_km < 2
        assert a.complete
        # The full boundary at the case-study density gives SB-510's 510 MW
        assert a.area_km2 * 4.5 == pytest.approx(510, rel=0.02)

    def test_pack_provenance(self) -> None:
        pack = load_region("southern-baltic")
        assert pack.missing_roles() == []
        for layer in pack.layers:
            assert layer.source and layer.license and layer.retrieved, layer.id
        assert pack.raster("bathymetry") is not None
        names = {f.name for layer in pack.by_role("protected") for f in layer.features}
        assert any("Ławica Słupska" in n for n in names)

    def test_flags_overlaps_and_protected_areas(self) -> None:
        pack = synthetic_pack()
        crit = Criteria(exclude_territorial_sea=False)
        over = assess_site(pack, crit, _box(16.65, 54.45, 16.87, 54.65)[0])  # 1.9 km from the cable
        status = {c.id: c.status for c in over.checks}
        assert status["owf"] == "fail" and status["cables"] == "warn"
        assert 0 < over.exclusion_shares["owf_area"] < 1
        near = assess_site(pack, crit, _box(16.25, 54.5, 16.35, 54.6)[0])
        n2k = next(c for c in near.checks if c.id == "natura2000")
        assert n2k.status == "warn" and "appropriate assessment" in n2k.detail
        assert near.protected_km == pytest.approx(0.05 * LocalProjection(16.5, 54.45).kx, abs=0.3)

    @pytest.mark.parametrize(
        "polygon,message",
        [
            ([[16.4, 54.8], [16.5, 54.8]], "three"),
            ([[16.3, 54.8], [16.5, 54.9], [16.5, 54.8], [16.3, 54.9]], "crosses"),
            ([[10.0, 54.8], [10.2, 54.8], [10.2, 54.9]], "inside the region"),
            ([[16.4, 54.8], [16.401, 54.8], [16.401, 54.801]], "smaller"),
        ],
    )
    def test_invalid_sites(self, polygon: list[list[float]], message: str) -> None:
        with pytest.raises(InvalidSiteError, match=message):
            assess_site(load_region("southern-baltic"), Criteria(), polygon)


# ── API ──────────────────────────────────────────────────────────


class TestAPI:
    def test_regions_and_layers(self) -> None:
        r = client.get(f"{API}/regions")
        assert r.status_code == 200
        assert [x["region"] for x in r.json()] == ["southern-baltic"]
        body = client.get(f"{API}/layers").json()
        roles = {layer["role"] for layer in body["layers"]}
        assert {
            "sea",
            "shore",
            "cable",
            "owf",
            "grid",
            "protected",
            "shipping",
            "restricted",
        } <= roles
        assert {"eez", "territorial", "bathymetry"} <= roles
        assert body["complete"] is True
        assert not [m for m in body["missing"] if m["essential"]]
        owf = next(layer for layer in body["layers"] if layer["role"] == "owf")
        assert owf["features"][0]["geometry"]["type"] == "Polygon"
        cards = {c["key"]: c for c in body["criteria"]}
        assert cards["territorial_sea_km"]["default"] == pytest.approx(22.224)
        assert all(c["provenance"] for c in body["criteria"])
        assert client.get(f"{API}/layers", params={"region": "atlantis"}).status_code == 404

    def test_suitability(self) -> None:
        r = client.post(f"{API}/suitability", json={"cell_km": 3})
        assert r.status_code == 200
        b = r.json()
        assert len(b["classes"]) == b["ny"] and len(b["classes"][0]) == b["nx"]
        areas = {a["name"]: a["area_km2"] for a in b["class_areas"]}
        assert areas["suitable"] > 0 and areas["excluded"] > 0
        reasons = {a["reason"] for a in b["reason_areas"]}
        assert {"land", "territorial_sea", "owf_area"} <= reasons
        # excluded cells carry no score
        for row_c, row_s in zip(b["classes"], b["scores"], strict=True):
            for c, s in zip(row_c, row_s, strict=True):
                assert (s is None) == (c in (0, -1))

    def test_suitability_overrides_and_validation(self) -> None:
        base = client.post(f"{API}/suitability", json={"cell_km": 3}).json()
        off = client.post(
            f"{API}/suitability",
            json={"cell_km": 3, "criteria": {"exclude_territorial_sea": False}},
        ).json()

        def excluded(b: dict[str, Any]) -> int:
            return next(a["cells"] for a in b["class_areas"] if a["name"] == "excluded")

        assert excluded(off) < excluded(base)
        bad = client.post(
            f"{API}/suitability", json={"criteria": {"shore_ideal_km": 90, "shore_max_km": 50}}
        )
        assert bad.status_code == 422
        assert client.post(f"{API}/suitability", json={"cell_km": 0.1}).status_code == 422

    def test_assess(self) -> None:
        r = client.post(f"{API}/assess", json={"polygon": SB510_SITE})
        assert r.status_code == 200
        b = r.json()
        assert b["area_km2"] == pytest.approx(112.3, rel=0.01)
        assert {c["status"] for c in b["checks"]} <= {"pass", "warn", "fail", "unknown", "info"}
        crossing = [[16.3, 54.8], [16.5, 54.9], [16.5, 54.8], [16.3, 54.9]]
        assert client.post(f"{API}/assess", json={"polygon": crossing}).status_code == 422
