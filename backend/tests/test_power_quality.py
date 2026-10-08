"""
Power quality (services/p2/power_quality.py).

Planning levels against IEC TR 61000-3-6 Table 2, the harmonic network model
(resonances, emission → voltage), IEC 61400-21 flicker and the filter design.
"""

from __future__ import annotations

import math
from dataclasses import replace

import pytest

from app.services.p2.network_model import SB510
from app.services.p2.power_quality import (
    DEFAULT_WTG_EMISSION_PCT,
    _impedance_column,
    compute_flicker,
    compute_harmonics,
    compute_resonance_scan,
    design_passive_filter,
    get_harmonic_limits,
    harmonic_filter_elements,
    harmonic_filter_impedance_ohm,
    planning_level_pct,
    size_harmonic_filter,
    summation_exponent,
)


class TestPlanningLevels:
    @pytest.mark.parametrize(
        ("h", "mv", "hv"),
        [
            (2, 1.8, 1.4),
            (3, 4.0, 2.0),
            (5, 5.0, 2.0),
            (7, 4.0, 2.0),
            (8, 0.5, 0.4),
            (11, 3.0, 1.5),
            (13, 2.5, 1.5),
        ],
    )
    def test_table_values(self, h, mv, hv):
        assert planning_level_pct(h, "MV") == mv
        assert planning_level_pct(h, "HV") == hv

    def test_formula_rows(self):
        assert planning_level_pct(17, "MV") == pytest.approx(1.7)  # 1.9·17/17 − 0.2
        assert planning_level_pct(17, "HV") == pytest.approx(1.2)
        assert planning_level_pct(25, "HV") == pytest.approx(1.2 * 17 / 25, abs=1e-3)
        assert planning_level_pct(10, "HV") == pytest.approx(0.35)  # 0.19 + 0.16
        assert planning_level_pct(21, "HV") == 0.2

    def test_thd_planning_levels(self):
        lim = get_harmonic_limits()
        assert lim["thd_limit_mv_pct"] == 6.5 and lim["thd_limit_hv_pct"] == 3.0
        assert len(lim["entries"]) == 24

    def test_summation_exponents(self):
        assert [summation_exponent(h) for h in (3, 5, 10, 11)] == [1.0, 1.4, 1.4, 2.0]


class TestNetworkModel:
    def test_fundamental_matches_short_circuit_impedance(self):
        # |Z(50 Hz)| at 66 kV ≈ grid + both transformers + cable ≈ 0.06 pu on 100 MVA
        assert abs(_impedance_column(1.0, 10_000.0, 45.0)[3]) == pytest.approx(0.06, abs=0.005)

    def test_low_order_cable_resonance_and_h17_peak_without_filter(self):
        bare = replace(SB510, harmonic_filter_mvar=0.0, harmonic_filter_tuned_order=0.0)
        scan = compute_resonance_scan(spec=bare)
        orders = [p["harmonic_order"] for p in scan["resonance_points"]]
        assert any(2.1 <= h <= 2.5 for h in orders)  # 108 km cable C vs grid/transformer L
        assert any(17.4 <= h <= 17.8 for h in orders)  # array C vs OSS transformer L, 880 Hz
        assert 17 in scan["critical_harmonics"]

    def test_filter_moves_the_h17_resonance_off_the_characteristic_orders(self):
        """With the 2 Mvar h16 filter the 880 Hz peak (×15.7) drops to ≈ 840 Hz, × 1.5."""
        for factor in (0.5, 1.0, 2.0):
            scan = compute_resonance_scan(grid_fault_level_mva=10_000.0 * factor)
            assert scan["critical_harmonics"] == []
            high = [p for p in scan["resonance_points"] if p["harmonic_order"] > 5]
            assert all(p["amplification"] < 3.0 for p in high)
            peak = max(high, key=lambda p: p["frequency_hz"])
            assert 830.0 <= peak["frequency_hz"] <= 850.0 and peak["amplification"] < 2.0

    def test_weaker_grid_lowers_the_first_resonance(self):
        strong = compute_resonance_scan(grid_fault_level_mva=10_000.0)["cable_resonant_freq_hz"]
        weak = compute_resonance_scan(grid_fault_level_mva=2_000.0)["cable_resonant_freq_hz"]
        assert weak < strong

    def test_scan_axis(self):
        scan = compute_resonance_scan(scan_max_hz=1000.0)
        assert scan["frequencies_hz"][0] == 50.0 and scan["frequencies_hz"][-1] == 1000.0
        assert len(scan["frequencies_hz"]) == len(scan["impedances_ohm"])


class TestHarmonics:
    def test_poc_compliant_with_typical_emission(self):
        r = compute_harmonics(DEFAULT_WTG_EMISSION_PCT, 400.0)
        assert r["bus"].startswith("PSE 400")
        assert r["thd_voltage_pct"] < 1.0 and r["compliant"]

    def test_resonance_amplifies_h17_at_66kv_without_filter(self):
        bare = replace(SB510, harmonic_filter_mvar=0.0, harmonic_filter_tuned_order=0.0)
        r = compute_harmonics(DEFAULT_WTG_EMISSION_PCT, 66.0, spec=bare)
        h17 = next(x for x in r["harmonics"] if x["order"] == 17)
        h5 = next(x for x in r["harmonics"] if x["order"] == 5)
        # a quarter of the h5 current, but a far larger voltage — past the plant's 50 % share
        assert h17["magnitude_pct"] > 5 * h5["magnitude_pct"]
        assert h17["impedance_ohm"] > 150.0
        assert r["assessment"] == "BORDERLINE" and 70.0 < h17["utilisation_pct"] < 80.0

    def test_designed_filter_brings_characteristic_orders_to_half_the_planning_level(self):
        """SB-510: 2 Mvar tuned to h16; h ≥ 5 at ≤ 50 % at the POC, 220 and 66 kV for 0.5–2 × S_sc.
        The h2 cable–grid resonance (105–120 Hz) stays ≤ 75 %: a 66 kV high-pass can't cure it."""
        assert (SB510.harmonic_filter_mvar, SB510.harmonic_filter_tuned_order) == (2.0, 16.0)
        assert size_harmonic_filter(SB510) == (2.0, 16.0)
        for factor in (0.5, 1.0, 2.0):
            for kv in (400.0, 220.0, 66.0):
                r = compute_harmonics(DEFAULT_WTG_EMISSION_PCT, kv, grid_ssc_mva=10_000.0 * factor)
                assert r["compliant"] and r["worst_utilisation_pct"] <= 75.0
                assert all(x["utilisation_pct"] <= 50.0 for x in r["harmonics"] if x["order"] >= 5)
        h17 = next(
            x
            for x in compute_harmonics(DEFAULT_WTG_EMISSION_PCT, 66.0)["harmonics"]
            if x["order"] == 17
        )
        assert h17["utilisation_pct"] < 35.0

    def test_filter_elements(self):
        """X_C − X_L = U²/Q, X_L = X_C/h_t², R = q·h_t·ω₀L; 50 Hz output = Q."""
        c, ind, r = harmonic_filter_elements(5.0, 18.0)
        assert c * 1e6 == pytest.approx(3.642, abs=0.001)
        assert ind * 1e3 == pytest.approx(8.585, abs=0.001)
        assert r == pytest.approx(72.8, abs=0.1)
        z1 = harmonic_filter_impedance_ohm(1.0, 5.0, 18.0)
        assert 66.0**2 / -z1.imag == pytest.approx(5.0, rel=0.01)  # capacitive, 5 Mvar

    def test_voltage_scales_with_emission_and_summation(self):
        one = compute_harmonics({11: 0.5}, 66.0, rated_mw=15.0)["harmonics"][0]["magnitude_pct"]
        farm = compute_harmonics({11: 0.5}, 66.0, rated_mw=510.0)["harmonics"][0]["magnitude_pct"]
        assert farm / one == pytest.approx(math.sqrt(34), rel=0.02)  # α = 2 above h10

    def test_thd_is_rss_of_bus_voltages(self):
        r = compute_harmonics(DEFAULT_WTG_EMISSION_PCT, 220.0)
        rss = math.sqrt(sum(x["magnitude_pct"] ** 2 for x in r["harmonics"]))
        assert r["thd_voltage_pct"] == pytest.approx(rss, abs=1e-3)


class TestFlicker:
    def test_strong_grid_full_converter_is_negligible(self):
        f = compute_flicker()
        assert f["pst"] < 0.05 and f["assessment"] == "PASS"
        assert (f["pst_limit"], f["plt_limit"]) == (0.8, 0.6)

    def test_scales_inversely_with_grid_strength(self):
        assert compute_flicker(grid_fault_level_mva=1_000.0)["pst"] == pytest.approx(
            10 * compute_flicker(grid_fault_level_mva=10_000.0)["pst"], rel=0.02
        )

    def test_switching_term_includes_factor_18(self):
        f = compute_flicker(annual_switching_operations=20_000)
        n, s_n = 34, 15.0 / 0.95
        n10 = 20_000 / n / (365.25 * 24 * 6)
        expected = n ** (1 / 3) * 18 * n10**0.31 * f["switching_coefficient"] * s_n / 10_000
        assert f["pst_switching"] == pytest.approx(expected, rel=0.01)
        assert (
            f["pst_switching"] > compute_flicker(annual_switching_operations=100)["pst_switching"]
        )


class TestFilter:
    def test_tuned_below_target_and_resonant(self):
        d = design_passive_filter(17, 50.0, 66.0, 10.0)
        assert d["tuned_frequency_hz"] == pytest.approx(17 * 0.97 * 50)
        f_lc = 1 / (2 * math.pi * math.sqrt(d["reactor_mh"] * 1e-3 * d["capacitor_uf"] * 1e-6))
        assert f_lc == pytest.approx(d["tuned_frequency_hz"], rel=1e-3)

    def test_attenuation_where_the_network_resonates(self):
        at_17 = design_passive_filter(17, 50.0)["insertion_loss_db"]
        at_5 = design_passive_filter(5, 50.0)["insertion_loss_db"]
        assert at_17 > at_5  # the filter matters most where |Z| is high
