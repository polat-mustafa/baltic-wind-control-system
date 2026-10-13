"""
IEC 60287 rating of the export route (engineering audit B-2). The method is checked
against CIGRE TB 880 case 0-1; the three-core cable's geometry against its datasheet.
"""

import pytest

from app.services.p2.cable_rating import (
    DATASHEET_CONDITION,
    EXPORT_3C_1000,
    ROUTE,
    calibrated_export_cable,
    cyclic_factor_by_superposition,
    cyclic_rating_factor,
    hdd_options,
    load_profile_check,
    rating,
    reference_case_tb880,
    route_ratings,
    subsea_cyclic_factor,
)
from app.services.p2.network_model import EXPORT_CABLE_1000


@pytest.mark.validation
def test_tb880_case_0_1_is_reproduced(evidence):
    """132 kV 630 mm² Cu single cores in touching trefoil, 1 m, 20 °C, 1.0 K·m/W, solid
    bonding: 821.78 A (TB 880 §4.5, as the open re-implementation computes it), T1 0.4199,
    T3 0.0867 (× 1.6), T4 1.5947 K·m/W, W_d 0.385 W/m, λ1 0.294."""
    r = reference_case_tb880()
    assert r.current_a == pytest.approx(821.78, abs=0.05)
    assert r.t1 == pytest.approx(0.41987, abs=1e-4)
    assert r.t3 == pytest.approx(0.08672, abs=1e-4)
    assert r.t4 == pytest.approx(1.59469, abs=1e-4)
    assert r.w_d == pytest.approx(0.38514, abs=1e-4)
    assert r.lambda1 == pytest.approx(0.2939, abs=1e-3)
    evidence(
        "p2-iec60287-tb880",
        area="P2 — HV grid",
        kind="reference",
        claim="IEC 60287-1-1 / -2-1 cable rating engine (export route sections, DTS)",
        against="CIGRE TB 880 case 0-1, 132 kV 630 mm² trefoil (open re-implementation "
        "cbl_CIGRE_TB880)",
        metric="continuous rating",
        value=r.current_a,
        unit="A",
        limit="= 821.78 A ± 0.05 A",
    )


def test_three_core_geometry_matches_the_datasheet():
    """The derived geometry gives the datasheet's C = 0.19 µF/km; T2 solved for 825 A is a
    plausible filler/bedding resistance (0.1–0.5 K·m/W)."""
    assert EXPORT_3C_1000.capacitance_f_per_m() * 1e12 == pytest.approx(
        EXPORT_CABLE_1000.c_nf_per_km, rel=0.01
    )
    cal = calibrated_export_cable()
    assert 0.1 < cal.t2_k_m_w < 0.5
    assert rating(cal, DATASHEET_CONDITION).current_a == pytest.approx(825.0, abs=0.01)


def test_the_hdd_landfall_is_the_bottleneck_of_the_1000_mm2_cable():
    """12 m deep in a duct the 1000 mm² cable rates ≈ 670 A — below the 778 A of full output;
    the SB-510 design (1600 mm², thermal grout) clears it."""
    opts = {o["option"]: o["rating_a"] for o in hdd_options()}
    assert opts["1000 mm², natural ground 1.0 K·m/W"] < 700.0
    design = opts["1600 mm², thermal grout 0.7 K·m/W (SB-510 design)"]
    assert design > 825.0 > max(v for k, v in opts.items() if "SB-510" not in k)


def test_every_section_carries_the_825_a_circuit_rating():
    """With the HDD design every section's IEC 60287 rating ≥ the 825 A the network uses."""
    rows = route_ratings()
    assert [r["section"] for r in rows] == [
        "OSS J-tube",
        "Subsea burial",
        "HDD landfall",
        "Land cable",
    ]
    assert min(r["rating_a"] for r in rows) >= 825.0


def test_thirty_years_of_wind_keep_every_section_below_90_c():
    rows = load_profile_check()
    assert all(r["hours_above_90c"] == 0.0 for r in rows)
    assert all(r["peak_conductor_c"] < 90.0 for r in rows)
    hdd = next(r for r in rows if r["section"] == "HDD landfall")
    # the deep HDD (150 h time constant) never reaches its steady full-output temperature
    assert hdd["peak_conductor_c"] < 80.0


# ── IEC 60853-2 cyclic rating ────────────────────────────────────

_SUBSEA = ROUTE[1][2]
_CYCLES = (
    [0.3] * 8 + [0.6] * 4 + [1.0] * 6 + [0.6] * 6,
    [0.2] * 12 + [1.0] * 12,
)


def test_a_flat_load_has_cyclic_factor_one():
    """Y = 1 every hour (μ = 1): the cycle is the steady rating, M = 1 exactly."""
    assert cyclic_rating_factor(calibrated_export_cable(), _SUBSEA, [1.0] * 24) == pytest.approx(
        1.0
    )


@pytest.mark.parametrize("cycle", _CYCLES)
def test_six_hour_formula_matches_full_superposition(cycle):
    """IEC 60853-2 keeps six hours of the cycle and replaces the rest by μ; superposing the
    whole periodic cycle on the same α(t)·(1 − k + kβ(t)) response agrees within 3 %."""
    c = calibrated_export_cable()
    m = cyclic_rating_factor(c, _SUBSEA, cycle)
    assert 1.0 < m < 1.5
    assert m == pytest.approx(cyclic_factor_by_superposition(c, _SUBSEA, cycle, days=10), rel=0.03)


def test_subsea_cyclic_factor_from_the_hindcast():
    """μ from 30 years of wind (charging current keeps I² well above zero at no wind)."""
    r = subsea_cyclic_factor()
    assert 0.3 < r["loss_load_factor"] < 1.0
    assert 1.0 < r["cyclic_factor_m"] < 1.3
