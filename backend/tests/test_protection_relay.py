"""
Protection scheme and coordination (services/p5/protection_relay.py).

Selectivity is judged on operating times at the IEC 60909 fault currents,
not on configured delays; the fault study must pick the zone's main
protection first and keep backups ≥ 300 ms behind it.
"""

from __future__ import annotations

import math

import pytest

from app.core.exceptions import ValidationError
from app.services.p5.protection_relay import (
    GRADING_PAIRS,
    OSS_RELAY_SETTINGS,
    SelectivityVerdict,
    apply_overrides,
    export_cable_fault_ka,
    get_relay_settings,
    get_tcc_plot_data,
    idmt_operating_time,
    oss_66kv_fault_levels_ka,
    ptoc_time_s,
    run_coordination_study,
    simulate_fault_clearance,
    verify_selectivity,
)

S = {s.setting_id: s for s in OSS_RELAY_SETTINGS}


class TestSettings:
    def test_registry(self):
        assert get_relay_settings() is OSS_RELAY_SETTINGS
        ids = [s.setting_id for s in OSS_RELAY_SETTINGS]
        assert len(ids) == len(set(ids)) == 10
        assert {"PDIF-87L", "PDIF-87B"} <= set(ids)

    def test_overcurrent_stages_are_idmt_with_cts(self):
        assert S["PTOC-01"].curve == "SI" and S["PTOC-01"].ct_primary_a == 1000.0
        assert S["PTOC-02"].curve == "SI" and S["PTOC-02"].tms > S["PTOC-01"].tms

    def test_voltage_frequency_stages_sit_outside_pse_ranges(self):
        assert S["PTUF-01"].pickup_value == 47.5 and S["PTOF-01"].pickup_value == 51.5
        assert S["PTUV-01"].time_delay > 2.5  # beyond the 2.5 s FRT profile
        assert S["PTOV-01"].pickup_value >= 1.15  # 1.118–1.15 pu must be held 60 min

    def test_iec_standard_inverse(self):
        # 10 × pickup, TMS 1: 0.14 / (10^0.02 − 1) = 2.97 s
        assert idmt_operating_time(10.0, 1.0, "SI") == pytest.approx(2.97, abs=0.01)
        assert idmt_operating_time(0.9, 1.0, "SI") == math.inf
        assert idmt_operating_time(5.0, 0.1, "DT", 0.4) == 0.4


class TestSelectivity:
    def test_fault_levels_from_iec_60909(self):
        i_max, i_min = oss_66kv_fault_levels_ka()
        assert i_max == pytest.approx(21.4, abs=0.2)
        assert i_min == pytest.approx(14.4, abs=0.2)

    def test_default_scheme_is_selective_at_real_currents(self):
        results = verify_selectivity()
        assert len(results) == len(GRADING_PAIRS)
        assert all(r.verdict == SelectivityVerdict.SELECTIVE for r in results)
        oc = results[0]
        # times are evaluated on the curves, not taken from configured delays
        assert oc.downstream_delay_s == pytest.approx(ptoc_time_s(S["PTOC-01"], 21.422), abs=1e-3)
        assert oc.actual_margin_ms >= 300.0

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

    def test_export_cable_is_cleared_by_differential_within_150_ms(self):
        for pos in (10.0, 50.0, 95.0):
            r = run_coordination_study("export_cable", position_pct=pos)
            assert r["main_relay"] == "PDIF-87L"
            assert r["main_clearance_ms"] <= 150.0
            assert r["backup_margin_ms"] >= 300.0
            assert r["assessment"] == "PASS"
        far = run_coordination_study("export_cable", position_pct=95.0)
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
