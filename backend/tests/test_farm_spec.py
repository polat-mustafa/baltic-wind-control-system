"""
FarmSpec / design(): the P2 network for any farm on the SB-510 topology.

- Golden test: the sizing rules give the SB-510 design back exactly.
- Rules for other farms, checked against the physics they stand for
  (circuit capacity with charging current, ωCV²L, transformer loading).
- A designed farm passes its own full-load load flow (0.95–1.05 p.u., ≤ 100 %).
- The X-Farm header switches the API from SB-510 to the learner's farm.
"""

import json
import math
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import DomainError
from app.main import app
from app.schemas.grid import LoadFlowScenario
from app.services.p2.load_flow import run_load_flow
from app.services.p2.network_model import (
    SB510,
    STRING_LAYOUT,
    build_network,
    design,
    export_charging_mvar,
    export_circuit_capacity_mw,
)
from app.services.p2.statcom_sizing import check_reactors

client = TestClient(app)


def _header(strings: list[int], export_km: float, array_km: float = 1.5, name: str = "Test farm"):
    body = {"name": name, "strings": strings, "export_km": export_km, "array_km": array_km}
    return {"X-Farm": quote(json.dumps(body))}


class TestDesignRules:
    def test_sb510_golden(self):
        """design() rebuilds both SB-510 designs: the original 45 km export (2 circuits,
        2 × 300 MVA, 3 × 80 MVAR, ±120 MVAR) and, from PZP_44, 76.5 km (3 × 170 MVAR)."""
        old = design(tuple(STRING_LAYOUT), 45.0, 1.5, "SB-510")
        assert (old.num_export_cables, old.oss_trafo_mva, old.onshore_trafo_mva) == (2, 300, 300)
        assert (old.num_reactors, old.reactor_unit_mvar, old.statcom_mvar) == (3, 80, 120)
        spec = design(tuple(STRING_LAYOUT), 76.5, 1.5, "SB-510")
        assert spec == SB510
        assert (spec.num_export_cables, spec.oss_trafo_mva, spec.onshore_trafo_mva) == (2, 300, 300)
        assert (spec.num_reactors, spec.reactor_unit_mvar, spec.statcom_mvar) == (3, 170, 120)
        assert check_reactors(SB510) == SB510  # the load-flow check keeps the reference design

    def test_cable_physics(self):
        """Q = ωCV²L ≈ 130 MVAR per 45 km circuit; P_circuit = √3·U·√(Imax² − (Ic/2)²) ≈ 356 MW."""
        assert export_charging_mvar(45.0) == pytest.approx(130.0, abs=0.1)
        ic = 2 * math.pi * 50 * 190e-9 * 45 * 220e3 / math.sqrt(3)  # ≈ 341 A
        assert export_circuit_capacity_mw(45.0) == pytest.approx(
            math.sqrt(3) * 220e3 * math.sqrt(950**2 - (ic / 2) ** 2) / 1e6
        )
        assert export_circuit_capacity_mw(75.0) < export_circuit_capacity_mw(45.0)

    def test_long_export_grows_reactors(self):
        """540 MW over 75 km: still 2 circuits, Q ≈ 433 MVAR → 3 × 170 MVAR (N+1)."""
        spec = design((6,) * 6, 75.0)
        assert spec.num_export_cables == 2
        assert spec.cable_q_mvar == pytest.approx(433.3, abs=0.5)
        assert (spec.num_reactors, spec.reactor_unit_mvar) == (3, 170)
        # one reactor out: the STATCOM covers the rest with its 15 % margin
        assert (spec.cable_q_mvar - 2 * 170) * 1.15 <= spec.statcom_mvar

    def test_gigawatt_farm(self):
        """1080 MW at 45 km: ⌈1080 / 356⌉ = 4 circuits; 540 MW sections → 2 × 600 MVA."""
        spec = design((6,) * 12, 45.0)
        assert spec.num_export_cables == 4
        assert spec.oss_trafo_mva == 600 and spec.onshore_trafo_mva == 600
        assert spec.statcom_mvar == 260  # 1080 × 120 / 510 = 254 → 260

    def test_small_farm(self):
        """20 turbines on 4 strings, 30 km: one circuit; 150 MW sections → 2 × 200 MVA."""
        spec = design((5, 5, 5, 5), 30.0, 1.4)
        assert spec.num_turbines == 20 and spec.capacity_mw == 300
        assert spec.num_export_cables == 1
        assert spec.oss_trafo_mva == 200  # 150 / 0.9 = 167 → 200
        assert spec.num_reactors == 2  # one circuit + one spare

    def test_long_single_circuit_statcom_bound(self):
        """120 MW over 73 km, one circuit: Q ≈ 211 MVAR. With both N+1 reactors in, they
        over-compensate by ≈ u − S/1.15; the STATCOM covers that only if S ≥ 1.15·Q/3."""
        spec = design((4, 4), 73.0, 1.15)
        assert spec.num_export_cables == 1 and spec.num_reactors == 2
        assert (
            spec.statcom_mvar >= 1.15 * spec.cable_q_mvar / 3
        )  # not the 30 MVAR of 120 MW × 120/510
        u = spec.reactor_unit_mvar
        assert abs(spec.cable_q_mvar - 2 * u) <= spec.statcom_mvar / 1.15  # normal: both in
        assert (spec.cable_q_mvar - u) * 1.15 <= spec.statcom_mvar  # N-1: one out

    def test_hvdc_distance_is_refused(self):
        with pytest.raises(DomainError) as e:
            design((6,) * 25, 200.0)
        assert e.value.status_code == 422 and "HVDC" in str(e.value)

    def test_network_follows_spec(self):
        spec = design((5, 5, 5, 5), 30.0, 1.4)
        net = build_network(spec=spec)
        assert len(net.sgen) == 20 + 1  # WTGs + STATCOM
        assert len(net.shunt) == spec.num_reactors
        export = net.line[net.line["name"] == "Export_220kV"].iloc[0]
        assert export["parallel"] == 1 and export["length_km"] == 30.0


class TestOwnFarmPhysics:
    @pytest.mark.parametrize(
        "strings, export_km",
        [((5, 5, 5, 5), 30.0), ((6,) * 6, 75.0), ((6,) * 12, 45.0), ((4, 4), 73.0), ((2,), 90.0)],
    )
    def test_full_load_passes_design_freeze(self, strings, export_km):
        """Designed farms meet PSE 0.95–1.05 p.u. with every branch ≤ 100 % at full output."""
        spec = check_reactors(design(strings, export_km))
        r = run_load_flow(LoadFlowScenario.FULL_LOAD, spec=spec)
        assert r.converged and r.voltage_compliant
        worst = max(
            [ln.loading_percent for ln in r.lines] + [t.loading_percent for t in r.transformers]
        )
        assert worst <= 100.0
        assert r.total_generation_mw == pytest.approx(spec.capacity_mw)

    def test_reactor_check_fixes_short_single_circuit(self):
        """30 km, one circuit: the balance rule gives 20 MVAR units; the reactor-N-1 load flow
        saturates the ±80 MVAR STATCOM until the unit is 30 MVAR."""
        rule = design((5, 5, 5, 5), 30.0, 1.4)
        assert rule.reactor_unit_mvar == 20
        assert check_reactors(rule).reactor_unit_mvar == 30

    def test_n_minus_1_trips_the_last_string(self):
        spec = design((5, 5, 5, 4), 30.0, 1.4)
        r = run_load_flow(LoadFlowScenario.N_MINUS_1, spec=spec)
        assert r.total_generation_mw == pytest.approx(15 * 15.0)


class TestFarmHeader:
    def test_no_header_is_sb510(self):
        data = client.get("/api/v1/grid/network-spec").json()
        assert data["source"] == "reference" and data["name"] == "SB-510"
        assert data["num_reactors"] == 3 and data["reactor_unit_mvar"] == 170

    def test_header_gives_the_project_design(self):
        r = client.get(
            "/api/v1/grid/network-spec", headers=_header([6] * 6, 75.0, name="Bałtyk test")
        )
        assert r.status_code == 200
        data = r.json()
        assert data["source"] == "project" and data["name"] == "Bałtyk test"  # any character
        assert data["total_capacity_mw"] == 540 and data["num_export_cables"] == 2
        assert data["reactor_unit_mvar"] == 170 and data["cable_q_mvar"] == pytest.approx(
            433.3, abs=0.1
        )

    def test_load_flow_uses_the_header(self):
        r = client.get("/api/v1/grid/load-flow/full_load", headers=_header([5, 5, 5, 5], 30.0, 1.4))
        assert r.status_code == 200
        assert r.json()["total_generation_mw"] == pytest.approx(300.0)

    @pytest.mark.parametrize(
        "header",
        [
            quote(json.dumps({"strings": [7], "export_km": 30, "array_km": 1.5})),  # > 6 per string
            quote(json.dumps({"strings": [], "export_km": 30, "array_km": 1.5})),
            quote(json.dumps({"strings": [6] * 26, "export_km": 30, "array_km": 1.5})),  # 156
            quote(json.dumps({"strings": [6], "export_km": 30, "array_km": 1.5, "x": 1})),
            "not json",
        ],
    )
    def test_bad_header_is_422(self, header):
        r = client.get("/api/v1/grid/network-spec", headers={"X-Farm": header})
        assert r.status_code == 422
        assert "X-Farm" in r.json()["detail"]

    def test_infeasible_farm_is_422(self):
        r = client.get("/api/v1/grid/network-spec", headers=_header([6] * 25, 200.0))
        assert r.status_code == 422 and "HVDC" in r.json()["detail"]
