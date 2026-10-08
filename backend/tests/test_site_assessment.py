"""Site assessment: geometry, screening rules, candidate-site reports and API.

Rules checked here (see app/services/site_assessment):
  * a point inside a Natura 2000 site, a shipping route or another wind
    farm area is never suitable;
  * the territorial sea (12 nm) is excluded for the Polish case study;
  * a missing layer is reported as "unknown", never as a silent pass;
  * the SB-510 site boundary reproduces the case study (≈ 112 km², ≈ 505 MW).
"""

from __future__ import annotations

import dataclasses
import math
import re
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.lifecycle.campaign import SB510_INSTALL_PORT_KM
from app.services.p1.weather_window import SB510_OM_PORT_KM
from app.services.p2.network_model import SB510_GRID_NODE
from app.services.site_assessment.assess import InvalidSiteError, assess_site
from app.services.site_assessment.criteria import Criteria, depth_band
from app.services.site_assessment.geo import (
    EARTH_RADIUS_KM,
    LocalProjection,
    distance_to_lines,
    distance_to_polygons,
    distance_to_polyline,
    is_simple,
    points_in_polygon,
    points_in_polygons,
    polygon_area_km2,
)
from app.services.site_assessment.layers import load_region, parse_pack
from app.services.site_assessment.sea_routes import sea_grid, sea_km
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
# SB-510 = energy basin PZP_44 between 16.42 and 16.63 °E (frontend SITE_BOUNDARY_GEO)
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
            "owf_points",
            "owf",
            "point",
            [
                {
                    "name": "Allocated farm",
                    "coordinates": [16.45, 54.4],
                    "power_mw": 500.0,
                    "status": "Planned",
                }
            ],
        ),
        layer(
            "energy",
            "msp_energy",
            "polygon",
            [
                {
                    "name": "E1 — energy basin",
                    "basin": "E1",
                    "coordinates": _box(16.3, 54.0, 16.95, 54.75),
                }
            ],
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

    def test_pruned_line_distance_matches_brute_force(self) -> None:
        rng = np.random.default_rng(3)
        lines = [
            np.cumsum(rng.normal(0, 3, (rng.integers(2, 40), 2)), axis=0) + rng.uniform(-50, 50, 2)
            for _ in range(25)
        ]
        px, py = rng.uniform(-80, 80, (2, 3000))
        brute = np.min([distance_to_polyline(px, py, ln) for ln in lines], axis=0)
        assert distance_to_lines(px, py, lines) == pytest.approx(brute)
        grid_x, grid_y = np.meshgrid(np.linspace(-60, 60, 40), np.linspace(-60, 60, 30))
        assert distance_to_lines(grid_x, grid_y, lines).shape == (30, 40)

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

    def test_outside_energy_basin(self) -> None:
        """Polish rule: offshore wind only inside the plan's energy basins."""
        pack = synthetic_pack()
        lon, lat = np.array([16.98, 16.5]), np.array([54.5, 54.35])
        ev = evaluate(pack, Criteria(exclude_territorial_sea=False), lon, lat)
        assert [REASONS[r] if r >= 0 else None for r in ev.reason] == ["outside_energy_basin", None]
        off = evaluate(
            pack, Criteria(exclude_territorial_sea=False, require_energy_basin=False), lon, lat
        )
        assert not off.excluded["outside_energy_basin"].any()
        no_plan = evaluate(
            synthetic_pack(msp_energy=True), Criteria(exclude_territorial_sea=False), lon, lat
        )
        assert not no_plan.excluded["outside_energy_basin"].any()

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
        assert not is_complete(synthetic_pack(msp_energy=True))


# ── Candidate site ───────────────────────────────────────────────


class TestAssess:
    def test_sb510_case_study(self) -> None:
        """SB-510 in energy basin PZP_44 (= site 44.E.1) against the open data.

        Every legal blocker passes: inside the basin, beyond 12 nm, no shipping basin,
        military area or munition dump, cables > 4 km away. What stays: the area is
        already allocated (44.E.1, PGE / Baltica 9, 2023 — SB-510 is a fictional use of
        it) and the Ławica Słupska Natura 2000 site is 2 km south (appropriate
        assessment). 34–54 m of water → jackets.
        """
        pack = load_region("southern-baltic")
        a = assess_site(pack, Criteria(), SB510_SITE)
        assert a.area_km2 == pytest.approx(112.9, rel=0.01)
        assert a.shore_km is not None and a.shore_km[0] > 45  # far beyond 12 nm (22.2 km)
        assert a.grid_node is not None and "Słupsk" in a.grid_node
        # straight line; the cable runs round the Natura 2000 site: 76.5 km
        assert 60 < a.grid_km < 70  # type: ignore[operator]
        assert a.depth_m is not None and a.depth_m[0] > 30 and a.depth_m[1] < 57  # EMODnet DTM
        assert a.foundation is not None and "jacket" in a.foundation
        assert a.excluded_fraction == 0
        assert a.capacity_mw == pytest.approx(a.area_km2 * (1 - a.excluded_fraction) * 4.5)
        status = {c.id: c.status for c in a.checks}
        assert status["territorial_sea"] == "pass" and status["eez"] == "pass"
        assert status["depth"] == "pass" and status["restricted"] == "pass"
        assert status["shipping"] == "pass" and status["cables"] == "pass"
        assert status["msp_energy"] == "pass" and a.energy_basins == ["PZP_44"]
        assert status["owf"] == "warn" and any("Baltica 9" in p for p in a.projects)
        assert status["natura2000"] == "warn"
        assert a.protected_km is not None and 1.5 < a.protected_km < 2.5
        assert a.complete
        # The full boundary at the case-study density gives SB-510's 510 MW
        assert a.area_km2 * 4.5 == pytest.approx(510, rel=0.02)

    def test_pack_provenance(self) -> None:
        pack = load_region("southern-baltic")
        assert pack.missing_roles() == []
        # the whole Polish EEZ (Marine Regions MRGID 5687: 14.20–19.81 °E, ≤ 55.92 °N)
        lon0, lat0, lon1, lat1 = pack.bbox
        assert lon0 <= 14.2 and lon1 >= 19.8 and lat1 >= 55.92 and lat0 <= 54.0
        basins = {str(f.props["basin"]) for f, _ in pack.named_polygons("msp_energy")}
        assert {"PZP_14", "PZP_43", "PZP_44", "PZP_45", "PZP_46", "PZP_53", "PZP_60"} <= basins
        projects = {f.name for f in pack.point_features("owf")}
        assert {"Baltic Power", "Baltica 9", "Baltyk II"} <= projects
        outlines = {f.name for f, _ in pack.named_polygons("owf")}
        assert "Baltic Power" in outlines
        grid = {name for name, _, _ in pack.points("grid")}
        assert any("Słupsk" in n for n in grid) and any("Żarnowiec" in n for n in grid)
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

    def test_energy_basin_and_allocated_project(self) -> None:
        pack = synthetic_pack()
        crit = Criteria(exclude_territorial_sea=False)
        inside = assess_site(pack, crit, _box(16.4, 54.3, 16.6, 54.45)[0])
        checks = {c.id: c for c in inside.checks}
        assert checks["msp_energy"].status == "pass" and "E1" in checks["msp_energy"].detail
        assert inside.energy_basins == ["E1"]
        # the basin already belongs to a real project: allocated, not free
        assert checks["owf"].status == "warn" and "Allocated farm" in checks["owf"].detail
        assert inside.projects == ["Allocated farm (500 MW, Planned)"]

        straddling = assess_site(pack, crit, _box(16.85, 54.3, 16.99, 54.4)[0])
        msp = next(c for c in straddling.checks if c.id == "msp_energy")
        assert msp.status == "fail"
        assert straddling.exclusion_shares["outside_energy_basin"] == pytest.approx(
            0.04 / 0.14, abs=0.05
        )
        generic = assess_site(
            pack,
            Criteria(exclude_territorial_sea=False, require_energy_basin=False),
            _box(16.85, 54.3, 16.99, 54.4)[0],
        )
        assert next(c for c in generic.checks if c.id == "msp_energy").status == "info"
        missing = assess_site(
            synthetic_pack(msp_energy=True), crit, _box(16.4, 54.3, 16.6, 54.45)[0]
        )
        assert next(c for c in missing.checks if c.id == "msp_energy").status == "unknown"

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
            "msp_energy",
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
        assert {"land", "territorial_sea", "outside_energy_basin", "shipping"} <= reasons
        # excluded cells carry no score
        for row_c, row_s in zip(b["classes"], b["scores"], strict=True):
            for c, s in zip(row_c, row_s, strict=True):
                assert (s is None) == (c in (0, -1))

    def test_suitability_overrides_and_validation(self) -> None:
        base = client.post(f"{API}/suitability", json={"cell_km": 3}).json()
        generic = client.post(
            f"{API}/suitability",
            json={"cell_km": 3, "criteria": {"require_energy_basin": False}},
        ).json()
        both = client.post(
            f"{API}/suitability",
            json={
                "cell_km": 3,
                "criteria": {"require_energy_basin": False, "exclude_territorial_sea": False},
            },
        ).json()

        def excluded(b: dict[str, Any]) -> int:
            return next(a["cells"] for a in b["class_areas"] if a["name"] == "excluded")

        assert excluded(both) < excluded(generic) < excluded(base)
        bad = client.post(
            f"{API}/suitability", json={"criteria": {"shore_ideal_km": 90, "shore_max_km": 50}}
        )
        assert bad.status_code == 422
        assert client.post(f"{API}/suitability", json={"cell_km": 0.1}).status_code == 422

    def test_assess(self) -> None:
        r = client.post(f"{API}/assess", json={"polygon": SB510_SITE})
        assert r.status_code == 200
        b = r.json()
        assert b["area_km2"] == pytest.approx(112.9, rel=0.01)
        assert {c["status"] for c in b["checks"]} <= {"pass", "warn", "fail", "unknown", "info"}
        crossing = [[16.3, 54.8], [16.5, 54.9], [16.5, 54.8], [16.3, 54.9]]
        assert client.post(f"{API}/assess", json={"polygon": crossing}).status_code == 422


def test_raster_endpoint_clips_bathymetry_to_the_bbox() -> None:
    """SB-510 lies in 37–51 m of water; the clip covers the bbox and agrees with sample()."""
    params = {"role": "bathymetry", "bbox": "16.42,55.0,16.63,55.12"}
    r = client.get("/api/v1/site/raster", params=params)
    assert r.status_code == 200, r.text
    body = r.json()
    grid = body["bands"]["values"]
    assert body["lon0"] <= 16.42 and body["lat0"] <= 55.0
    assert body["lon0"] + (len(grid[0]) - 1) * body["dlon"] >= 16.63 - 1e-9
    assert body["lat0"] + (len(grid) - 1) * body["dlat"] >= 55.12 - 1e-9
    assert len(grid) * len(grid[0]) < 400
    depth = load_region("southern-baltic").raster("bathymetry")
    assert depth is not None
    j, i = 3, 4
    lon, lat = body["lon0"] + i * body["dlon"], body["lat0"] + j * body["dlat"]
    expected = float(depth.sample(np.array([lon]), np.array([lat]))[0])
    assert grid[j][i] == pytest.approx(expected, abs=1e-6)
    assert 30 < grid[j][i] < 60
    assert body["source"]


def test_raster_endpoint_rejects_bad_requests() -> None:
    def status(role: str, bbox: str) -> int:
        return client.get("/api/v1/site/raster", params={"role": role, "bbox": bbox}).status_code

    assert status("bathymetry", "16.6,55,16.4,55.1") == 422  # min > max
    assert status("bathymetry", "a,b,c,d") == 422
    assert status("bathymetry", "0,0,1,1") == 422  # no overlap
    assert status("nope", "16.4,55,16.6,55.1") == 404
    assert status("bathymetry", "10,50,25,60") == 422  # too large


# ── Seabed substrate (EMODnet Geology, Folk 5) ──────────────────


def _with_seabed(rows: list[str]) -> Any:
    """The synthetic pack plus a class raster stored as digit rows (0.05° grid from 16.0 / 54.0)."""
    base = synthetic_pack()
    seabed = parse_pack(
        {
            "region": "t",
            "title": "t",
            "bbox": [16.0, 53.9, 17.0, 55.0],
            "pending": [],
            "layers": [
                {
                    "id": "seabed",
                    "title": "seabed",
                    "role": "seabed",
                    "geometry": "raster",
                    "source": "test",
                    "license": "test",
                    "retrieved": "2026-01-01",
                    "raster": {
                        "lon0": 16.0,
                        "lat0": 54.0,
                        "dlon": 0.05,
                        "dlat": 0.05,
                        "rows": rows,
                    },
                }
            ],
        }
    )
    return dataclasses.replace(base, layers=base.layers + seabed.layers)


def test_seabed_rows_decode_to_classes_with_no_data() -> None:
    pack = _with_seabed(["0123", "4500"])
    r = pack.raster("seabed")
    assert r is not None
    assert np.isnan(r.values[0, 0]) and r.values[0, 3] == 3 and r.values[1, 1] == 5
    # nearest node, not an interpolated class
    assert r.nearest(np.array([16.074]), np.array([54.0]))[0] == 1
    assert r.nearest(np.array([16.076]), np.array([54.0]))[0] == 2
    assert np.isnan(r.nearest(np.array([15.9]), np.array([54.0]))[0])


def test_seabed_check_passes_on_sand_and_warns_on_rock() -> None:
    site = [[16.4, 54.3], [16.6, 54.3], [16.6, 54.5], [16.4, 54.5]]
    sand = assess_site(_with_seabed(["2" * 21] * 21), Criteria(), site)
    assert sand.seabed == {"Sand": 1.0}
    assert next(c for c in sand.checks if c.id == "seabed").status == "pass"
    rock = assess_site(_with_seabed(["2" * 21] * 8 + ["5" * 21] * 13), Criteria(), site)
    assert rock.seabed is not None and 0 < rock.seabed["Rock and boulders"] < 1
    check = next(c for c in rock.checks if c.id == "seabed")
    assert check.status == "warn" and "drive-drill-drive" in check.detail
    no_layer = assess_site(synthetic_pack(), Criteria(), site)
    assert no_layer.seabed is None
    assert next(c for c in no_layer.checks if c.id == "seabed").status == "unknown"


def test_sb510_seabed_is_till_gravel_and_sand() -> None:
    """EMODnet / PGI-NRI 1:200 000: the Słupsk Bank area is mixed sediment and gravel."""
    a = assess_site(load_region("southern-baltic"), Criteria(), SB510_SITE)
    assert a.seabed is not None
    assert sum(a.seabed.values()) == pytest.approx(1.0)
    assert a.seabed["Mixed sediment"] == pytest.approx(0.40, abs=0.05)
    assert a.seabed["Coarse-grained sediment"] == pytest.approx(0.31, abs=0.05)
    assert a.seabed["Sand"] == pytest.approx(0.29, abs=0.05)
    assert next(c for c in a.checks if c.id == "seabed").status == "warn"


def test_seabed_raster_and_class_cards_over_the_api() -> None:
    r = client.get(
        "/api/v1/site/raster", params={"role": "seabed", "bbox": "16.42,55.0,16.63,55.12"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["classes"]["5"] == "Rock and boulders"
    codes = {v for row in body["bands"]["values"] for v in row if v is not None}
    assert codes <= {1, 2, 3, 4, 5} and {3, 4} <= codes
    cards = client.get(f"{API}/layers").json()["seabed_classes"]
    assert [c["code"] for c in cards] == [1, 2, 3, 4, 5]
    assert next(c for c in cards if c["name"] == "Sand")["foundation_factor"] == 1.0
    assert all(c["quality"] == "illustrative" for c in cards)


# ── Ports and sea routes ─────────────────────────────────────────


def test_sb510_ports_by_sea() -> None:
    """Ustka (PGE Baltica O&M base) is the nearest O&M port, Rønne the nearest installation
    port; routes stay at sea (Gdańsk goes round the Hel peninsula)."""
    a = assess_site(load_region("southern-baltic"), Criteria(), SB510_SITE)
    km = {p.name: p.km for p in a.ports}
    om = [p for p in a.ports if p.use == "O&M"]
    inst = [p for p in a.ports if p.use == "installation"]
    assert om[0].name == "Ustka" and om[0].km == pytest.approx(SB510_OM_PORT_KM, abs=0.05)
    assert inst[0].name == "Rønne (DK)"
    assert inst[0].km == pytest.approx(SB510_INSTALL_PORT_KM, abs=0.05)
    # the straight line Gdańsk T5 → SB-510 is ≈ 150 km; round Hel it is longer
    assert km["Gdańsk T5"] is not None and km["Gdańsk T5"] > 175
    assert km["Łeba"] == pytest.approx(71.2, abs=1.0)
    check = next(c for c in a.checks if c.id == "ports")
    assert check.status == "info" and "Ustka" in check.detail and "CTV" in check.detail
    # the frontend twin (lib/lifecycle/farm.ts SB510_PORTS)
    ts = Path(__file__).parents[2] / "frontend/src/lib/lifecycle/farm.ts"
    if ts.exists():  # backend-only checkout
        twin = re.findall(r'name: "([^"]+)", km: ([\d.]+)', ts.read_text(encoding="utf-8"))
        assert twin == [
            (inst[0].name, str(SB510_INSTALL_PORT_KM)),
            (om[0].name, str(SB510_OM_PORT_KM)),
        ]


def test_sea_route_goes_round_land() -> None:
    """A wall of land across the synthetic sea forces a detour around its end."""
    pack = synthetic_pack()
    grid = sea_grid(pack)
    assert grid is not None
    port = (16.05, 54.5)
    lon, lat = np.array([16.95]), np.array([54.5])
    straight = sea_km(pack, port, lon, lat)
    assert straight == pytest.approx(0.9 * 111.19 * math.cos(math.radians(54.95)), rel=0.05)
    wall = dataclasses.replace(
        pack,
        layers=pack.layers
        + parse_pack(
            {
                "region": "t",
                "title": "t",
                "bbox": [16.0, 53.9, 17.0, 55.0],
                "pending": [],
                "layers": [
                    {
                        "id": "wall",
                        "title": "wall",
                        "role": "shore",
                        "geometry": "line",
                        "source": "t",
                        "license": "t",
                        "retrieved": "t",
                        "features": [{"name": "spit", "coordinates": [[16.5, 54.0], [16.5, 54.8]]}],
                    }
                ],
            }
        ).layers,
    )
    detour = sea_km(wall, port, lon, lat)
    assert detour is not None and straight is not None
    # shortest way round: up to the end of the spit (54.8 °N) and down again
    kx = 111.19 * math.cos(math.radians(54.95))
    round_end = 2 * math.hypot(0.45 * kx, 0.3 * 111.19)
    assert round_end * 0.98 < detour < round_end * 1.2


# ── Grid connection points ───────────────────────────────────────


def test_sb510_grid_nodes_ranked_and_choosable() -> None:
    """Nearest PSE node = Słupsk Wierzbięcin (existing); Krzemienica is planned (PSE)."""
    pack = load_region("southern-baltic")
    a = assess_site(pack, Criteria(), SB510_SITE)
    assert a.grid_node == SB510_GRID_NODE and a.grid_km == a.grid_nodes[0].km
    assert [n.km for n in a.grid_nodes] == sorted(n.km for n in a.grid_nodes)
    by_name = {n.name: n for n in a.grid_nodes}
    assert by_name["Krzemienica 400 kV"].status == "planned"
    assert "inwestycje.pse.pl" in by_name["Krzemienica 400 kV"].basis
    assert by_name["Choczewo 400 kV"].status == "commissioning"
    assert next(c for c in a.checks if c.id == "grid").status == "info"
    chosen = assess_site(pack, Criteria(), SB510_SITE, grid_node="Krzemienica 400 kV")
    assert chosen.grid_node == "Krzemienica 400 kV"
    assert chosen.grid_km == by_name["Krzemienica 400 kV"].km
    check = next(c for c in chosen.checks if c.id == "grid")
    assert check.status == "warn" and "Bałtyk 1" in check.detail
    with pytest.raises(InvalidSiteError, match="unknown grid node"):
        assess_site(pack, Criteria(), SB510_SITE, grid_node="Nowhere 400 kV")


def test_grid_node_over_the_api() -> None:
    body = {"polygon": SB510_SITE, "grid_node": "Żarnowiec 400/110 kV"}
    r = client.post(f"{API}/assess", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["grid_node"] == "Żarnowiec 400/110 kV"
    assert {n["status"] for n in data["grid_nodes"]} == {"existing", "commissioning", "planned"}
    bad = client.post(f"{API}/assess", json={**body, "grid_node": "Nowhere"})
    assert bad.status_code == 422
