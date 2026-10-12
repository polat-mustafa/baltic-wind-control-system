"""
Protection scheme and coordination (services/p5/protection_relay.py).

Selectivity is judged on operating times at the IEC 60909 fault currents,
not on configured delays; the fault study must pick the zone's main
protection first and keep backups ≥ 300 ms behind it.
"""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ValidationError
from app.main import app
from app.services.p2.network_model import SB510, design
from app.services.p5.protection_relay import (
    GRADING_PAIRS,
    OSS_RELAY_SETTINGS,
    SelectivityVerdict,
    apply_overrides,
    ct_primary_a,
    export_cable_fault_ka,
    get_tcc_plot_data,
    head_cable_mm2,
    oss_66kv_fault_levels_ka,
    ptoc_time_s,
    relay_settings,
    run_coordination_study,
    simulate_fault_clearance,
    verify_selectivity,
)

S = {s.setting_id: s for s in OSS_RELAY_SETTINGS}


class TestSelectivity:
    def test_fault_levels_from_iec_60909(self):
        i_max, i_min = oss_66kv_fault_levels_ka()
        assert i_max == pytest.approx(19.5, abs=0.2)  # 108 km export: weaker grid infeed
        # min: c = 1.0, S_k 8 GVA, bus coupler open → one 300 MVA OSS unit, no converter infeed
        # (Σ X at 66 kV ≈ 0.54 grid + 1.02 onshore + 0.58 cable + 1.82 OSS = 3.95 Ω → 9.6 kA)
        assert i_min == pytest.approx(9.6, abs=0.2)

    def test_default_scheme_is_selective_at_real_currents(self, evidence):
        results = verify_selectivity()
        assert len(results) == len(GRADING_PAIRS)
        assert all(r.verdict == SelectivityVerdict.SELECTIVE for r in results)
        oc = results[0]
        # times are evaluated on the curves, not taken from configured delays
        i_max = oss_66kv_fault_levels_ka()[0]
        assert oc.downstream_delay_s == pytest.approx(ptoc_time_s(S["PTOC-01"], i_max), abs=1e-2)
        assert oc.actual_margin_ms >= 300.0
        evidence(
            "p3-selectivity-margin",
            area="P3 — SCADA & protection",
            kind="standard",
            claim="66 kV feeder vs incomer overcurrent grading at the IEC 60909 fault current",
            against="grading margin practice (≥ 300 ms: breaker + relay overshoot + safety)",
            metric="time margin, evaluated on both curves",
            value=oc.actual_margin_ms,
            unit="ms",
            limit="≥ 300 ms",
        )

    def test_low_incomer_tms_breaks_selectivity(self):
        bad = apply_overrides({"PTOC-02": {"tms": 0.05}})
        oc = verify_selectivity(bad)[0]
        assert oc.verdict == SelectivityVerdict.NON_SELECTIVE
        assert oc.actual_margin_ms < 0


class TestFaultStudy:
    def test_string_feeder_fault(self):
        r = run_coordination_study("string_feeder")
        assert r["first_relay"] == "PTOC-01" and r["main_relay"] == "PTOC-01"
        assert r["backup_margin_ms"] >= 300.0
        assert r["selective"] and r["fast_enough"] and r["assessment"] == "PASS"
        assert r["time_limit_s"] > 1.0  # head-cable I²t withstand ≫ backup clearance

    def test_export_cable_is_cleared_by_differential_within_150_ms(self, evidence):
        for pos in (10.0, 50.0, 95.0):
            r = run_coordination_study("export_cable", position_pct=pos)
            assert r["main_relay"] == "PDIF-87L"
            assert r["main_clearance_ms"] <= 150.0
            assert r["backup_margin_ms"] >= 300.0
            assert r["assessment"] == "PASS"
        far = run_coordination_study("export_cable", position_pct=95.0)
        evidence(
            "p3-export-87l",
            area="P3 — SCADA & protection",
            kind="standard",
            claim="Export cable fault at 95 % of 108 km cleared by line differential 87L",
            against="PSE FRT profile allows 0 pu for 150 ms only: clear within it",
            metric="main protection clearance incl. breaker",
            value=far["main_clearance_ms"],
            unit="ms",
            limit="≤ 150 ms",
        )
        assert "PDIS-Z1" not in [e["relay_id"] for e in far["relay_sequence"]]  # beyond 80 % reach

    def test_fault_current_falls_along_the_cable(self):
        near_grid, _ = export_cable_fault_ka(0.0)
        far_grid, conv = export_cable_fault_ka(100.0)
        assert near_grid > far_grid > 0
        assert conv == pytest.approx(630.0 / (math.sqrt(3) * 220.0), rel=1e-3)

    def test_busbar_faults_use_busbar_differential(self):
        for loc in ("oss_busbar_66kv", "oss_busbar_220kv"):
            r = run_coordination_study(loc)
            assert r["first_relay"] == "PDIF-87B"
            assert r["main_clearance_ms"] == pytest.approx(80.0)

    def test_legacy_names_and_errors(self):
        assert run_coordination_study("hv_busbar")["fault_location"] == "oss_busbar_220kv"
        with pytest.raises(ValidationError):
            run_coordination_study("WTG_ARRAY")
        with pytest.raises(ValidationError):
            run_coordination_study("string_feeder", fault_type="ph_e")

    def test_fault_clearance_includes_break_time_only(self):
        r = simulate_fault_clearance("3ph", "export_cable", position_pct=50.0)
        assert r["total_clearance_time_ms"] == pytest.approx(25.0 + 60.0)
        assert r["arc_extinction_time_ms"] == 0.0 and r["compliant"]
        high_z = simulate_fault_clearance("3ph", "string_feeder", fault_impedance_ohm=2.0)
        assert high_z["fault_current_ka"] < oss_66kv_fault_levels_ka()[0]
        assert high_z["first_relay_time_ms"] > 236.0  # less current → slower IDMT


def test_tcc_curves_use_each_relays_own_settings():
    curves = {c["relay_id"]: c for c in get_tcc_plot_data()}
    assert set(curves) == {"PTOC-01", "PTOC-02"}
    assert curves["PTOC-01"]["pickup_ka"] == pytest.approx(1.2)
    assert curves["PTOC-02"]["pickup_ka"] == pytest.approx(3.6)
    at_20ka = {
        rid: min(c["points"], key=lambda p: abs(p["current_ka"] - 20.0))["time_s"]
        for rid, c in curves.items()
    }
    assert at_20ka["PTOC-02"] - at_20ka["PTOC-01"] > 0.3


class TestOwnFarm:
    """The scheme follows the modelled farm (X-Farm): CTs, incomer TMS, fault levels."""

    SMALL = '{"name":"T","strings":[4,4],"export_km":40,"array_km":1.6}'

    def test_sb510_settings_follow_from_the_sizing_rules(self):
        assert relay_settings(SB510) == OSS_RELAY_SETTINGS
        assert ct_primary_a(787.0) == 1000.0  # 6 × 15 MW at 66 kV, × 1.1 = 866 A
        assert ct_primary_a(2624.0) == 3000.0  # 300 MVA at 66 kV
        assert head_cable_mm2(SB510) == 630.0  # 5-turbine strings

    def test_small_farm_gets_its_own_cts_and_a_graded_incomer(self):
        spec = design((4, 4), 40.0, 1.6, "T")
        s = {r.setting_id: r for r in relay_settings(spec)}
        assert (s["PTOC-01"].ct_primary_a, s["PTOC-02"].ct_primary_a) == (600.0, 1000.0)
        # closer CTs: TMS 0.15 would grade only ≈ 200 ms → the incomer steps up to 0.20
        assert s["PTOC-02"].tms == pytest.approx(0.20)
        assert all(r.verdict == SelectivityVerdict.SELECTIVE for r in verify_selectivity(spec=spec))
        assert oss_66kv_fault_levels_ka(spec)[0] < oss_66kv_fault_levels_ka()[0]
        r = run_coordination_study("string_feeder", spec=spec)
        assert r["assessment"] == "PASS" and "500 mm²" in r["time_criterion"]

    def test_endpoints_follow_x_farm(self):
        from urllib.parse import quote

        client = TestClient(app)
        base = "/api/v1/grid/protection"
        h = {"X-Farm": quote(self.SMALL)}
        ct = {r["setting_id"]: r["ct_primary_a"] for r in client.get(f"{base}/relays").json()}
        own = {
            r["setting_id"]: r["ct_primary_a"]
            for r in client.get(f"{base}/relays", headers=h).json()
        }
        assert (ct["PTOC-02"], own["PTOC-02"]) == (3000.0, 1000.0)
        body = {"fault_location": "oss_busbar_66kv", "include_tcc_data": True}
        sb = client.post(f"{base}/coordination-study", json=body).json()
        small = client.post(f"{base}/coordination-study", json=body, headers=h).json()
        assert small["fault_current_ka"] < sb["fault_current_ka"]
        assert small["tcc_data"]["fault_markers"][0]["current_ka"] < 10.0


class TestEarthFaults:
    """Engineering audit F5: the resistance-earthed 66 kV array and its residual stages."""

    @pytest.mark.validation
    def test_earth_fault_current_is_set_by_the_ner_and_the_cable_capacitance(self, evidence):
        """Hand check (min case, c = 1.0, one NER): resistive NER current U0/R_N = 1 kA and
        the capacitive current of all strings 3ωC0U0 add in quadrature."""
        from app.services.p2.network_model import NER_OHM
        from app.services.p2.short_circuit import earth_fault_levels
        from app.services.p5.protection_relay import string_capacitive_earth_fault_a

        u0 = 66e3 / 3**0.5
        i_c = sum(string_capacitive_earth_fault_a())
        hand = (u0 / NER_OHM) ** 2 + i_c**2
        lo = earth_fault_levels("min")["OSS_66kV"]
        assert lo["ik1_ka"] * 1e3 == pytest.approx(hand**0.5, rel=0.03)
        evidence(
            "p2-earth-fault-ner",
            area="P2 — HV grid",
            kind="analytic",
            claim="pandapower IEC 60909 single-phase fault, NER-earthed 66 kV array (min case)",
            against="hand calculation: U0/R_N and 3ωC0U0 of all strings in quadrature",
            metric="I_k1 / hand value",
            value=lo["ik1_ka"] * 1e3 / hand**0.5,
            unit="−",
            limit="= 1 ± 0.03",
        )
        hi = earth_fault_levels("max")["OSS_66kV"]
        # coupler closed (two NERs) and the converters' share: still far below phase faults
        assert lo["ik1_ka"] < hi["ik1_ka"] < 0.25 * oss_66kv_fault_levels_ka()[0]

    def test_residual_stages_are_selective_and_ignore_healthy_feeders(self):
        from app.services.p5.protection_relay import run_earth_fault_study

        r = run_earth_fault_study()
        assert r["assessment"] == "PASS" and r["selective"] and r["ner_within_rating"]
        feeder = r["settings"][0]
        assert r["no_sympathetic_trip"]
        assert feeder.pickup_value >= 1.3 * max(r["healthy_feeder_capacitive_a"])
        assert r["backup_margin_ms"] == pytest.approx(400.0)

    def test_high_resistance_fault_beyond_the_reach_is_reported(self):
        from app.services.p5.protection_relay import run_earth_fault_study

        reach = run_earth_fault_study()["max_detectable_resistance_ohm"]
        assert 150 < reach < 400  # ≈ U0 / pickup − R_N
        assert run_earth_fault_study(reach * 0.9)["relay_sequence"][0]["operated"]
        far = run_earth_fault_study(reach * 1.5)
        assert not far["relay_sequence"][0]["operated"] and far["assessment"].startswith("FAIL")
