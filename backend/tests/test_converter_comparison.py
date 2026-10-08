"""
GFL vs GFM after a grid phase jump (services/p2/converter_comparison.py).

The tests pin the established behaviour the SMIB model must reproduce:
grid strength seen at the converter terminals is far below the POC value,
a GFL unit gives (almost) no inertial power response but needs a strong
grid, a GFM unit answers with synchronising power and is current-limited in
stiff grids.
"""

import pytest

from app.schemas.grid import ConverterType
from app.services.p2.converter_comparison import (
    GFM_CURRENT_LIMIT_PU,
    VERY_WEAK_GRID_SSC_MVA,
    get_comparison_response,
    grid_impedance_pu,
    run_converter_comparison,
    run_weak_grid_comparison,
)
from app.services.p2.network_model import EXPORT_CABLE_LENGTH_KM, TOTAL_CAPACITY_MW


@pytest.fixture(scope="module")
def strong():
    return run_converter_comparison(grid_ssc_mva=10_000.0)


@pytest.fixture(scope="module")
def weak():
    return run_weak_grid_comparison()


def test_scr_at_poc_and_terminals(strong):
    gfl, _ = strong
    assert gfl.scr == pytest.approx(10_000 / TOTAL_CAPACITY_MW, rel=0.01)
    # transformers + 108 km of cable cost ≈ 0.29 p.u. → SCR ≈ 2.9 at the 66 kV busbar
    assert 2.8 < gfl.scr_terminal < 3.0
    assert abs(grid_impedance_pu(10_000.0, EXPORT_CABLE_LENGTH_KM)) == pytest.approx(
        1 / gfl.scr_terminal, rel=0.01
    )


def test_both_stable_in_strong_grid(strong):
    gfl, gfm = strong
    assert gfl.converter_type == ConverterType.GFL and gfl.stable
    assert gfm.converter_type == ConverterType.GFM and gfm.stable


def test_gfm_gives_inertial_power_gfl_does_not(strong):
    gfl, gfm = strong
    assert gfm.power_swing_mw > 10 * gfl.power_swing_mw
    # the PLL estimate spikes, the virtual rotor barely moves
    assert gfl.frequency_deviation_hz > 10 * gfm.frequency_deviation_hz


def test_gfm_hits_current_limit_in_stiff_grid_for_large_jump():
    r = get_comparison_response("strong_grid", 10_000.0, phase_jump_deg=50.0)
    assert r.gfm_result.peak_current_pu == pytest.approx(GFM_CURRENT_LIMIT_PU, abs=1e-3)
    assert "current limit" in r.gfm_advantage


def test_weaker_grid_moves_gfl_voltage_more(strong, weak):
    assert weak[0].voltage_deviation_pu > strong[0].voltage_deviation_pu
    assert weak[1].stable


def test_gfl_loses_synchronism_in_very_weak_grid_gfm_does_not():
    r = get_comparison_response("very_weak_grid", VERY_WEAK_GRID_SSC_MVA, phase_jump_deg=40.0)
    assert not r.gfl_result.stable
    assert r.gfm_result.stable
    assert "slipped a pole" in r.gfm_advantage


def test_time_series_shape():
    r = get_comparison_response("strong_grid")
    assert len(r.time_series) == 1000  # 2 s at 2 ms
    first = r.time_series[0]
    assert first.gfl_p_mw == pytest.approx(TOTAL_CAPACITY_MW, rel=0.01)
    assert first.gfm_p_mw == pytest.approx(TOTAL_CAPACITY_MW, rel=0.01)
    assert first.gfl_f_hz == pytest.approx(50.0)
