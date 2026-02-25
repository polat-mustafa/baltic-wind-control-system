"""
Unit tests for GFL vs GFM converter comparison (P2B — converter_comparison.py).

Tests validate that both converter types are stable at high SCR, and that
GFM shows advantage at low SCR (weak grid conditions).

Test Strategy
-------------
- Strong grid (SCR ≈ 19.6): both GFL and GFM stable
- Weak grid (SCR ≈ 3.9): GFM advantage over GFL
- GFM always stable (voltage source behaviour)
- Educational summary populated
- Voltage deviation and settling time reasonable
"""

import pytest

from app.schemas.grid import ConverterType
from app.services.p2.converter_comparison import (
    get_comparison_response,
    run_converter_comparison,
    run_weak_grid_comparison,
)

# ── Strong Grid Tests ────────────────────────────────────────────


class TestStrongGrid:
    """Tests for converter comparison at strong grid (SCR ≈ 19.6)."""

    def test_gfl_stable_strong_grid(self):
        """GFL must be stable at strong grid (SCR ≈ 19.6)."""
        gfl, _ = run_converter_comparison(
            scenario="strong_grid",
            grid_ssc_mva=10_000.0,
        )
        assert gfl.stable, "GFL unstable at strong grid"
        assert gfl.converter_type == ConverterType.GFL

    def test_gfm_stable_strong_grid(self):
        """GFM must be stable at strong grid (SCR ≈ 19.6)."""
        _, gfm = run_converter_comparison(
            scenario="strong_grid",
            grid_ssc_mva=10_000.0,
        )
        assert gfm.stable, "GFM unstable at strong grid"
        assert gfm.converter_type == ConverterType.GFM

    def test_scr_calculated_correctly(self):
        """SCR must be correctly calculated as Ssc / P_rated."""
        gfl, _ = run_converter_comparison(grid_ssc_mva=10_000.0)
        expected_scr = 10_000.0 / 510.0
        assert gfl.scr == pytest.approx(expected_scr, rel=0.01)

    def test_both_have_small_deviations(self):
        """Both converters should have small voltage deviations at strong grid."""
        gfl, gfm = run_converter_comparison(grid_ssc_mva=10_000.0)
        assert gfl.voltage_deviation_pu < 0.10, "GFL deviation too large at strong grid"
        assert gfm.voltage_deviation_pu < 0.10, "GFM deviation too large at strong grid"


# ── Weak Grid Tests ──────────────────────────────────────────────


class TestWeakGrid:
    """Tests for converter comparison at weak grid (SCR ≈ 3.9)."""

    def test_gfm_stable_weak_grid(self):
        """GFM must remain stable at weak grid (SCR ≈ 3.9)."""
        _, gfm = run_weak_grid_comparison(grid_ssc_mva=2_000.0)
        assert gfm.stable, "GFM should be stable even at weak grid"

    def test_gfm_advantage_at_weak_grid(self):
        """GFM must show lower voltage deviation than GFL at weak grid."""
        gfl, gfm = run_weak_grid_comparison(grid_ssc_mva=2_000.0)
        assert gfm.voltage_deviation_pu <= gfl.voltage_deviation_pu, (
            f"GFM deviation ({gfm.voltage_deviation_pu}) should be ≤ "
            f"GFL deviation ({gfl.voltage_deviation_pu}) at weak grid"
        )

    def test_gfm_shorter_settling_at_weak_grid(self):
        """GFM should settle faster than GFL at weak grid."""
        gfl, gfm = run_weak_grid_comparison(grid_ssc_mva=2_000.0)
        assert gfm.settling_time_s <= gfl.settling_time_s, (
            f"GFM settling ({gfm.settling_time_s}s) should be ≤ "
            f"GFL settling ({gfl.settling_time_s}s)"
        )


# ── Comparison Response Tests ────────────────────────────────────


class TestComparisonResponse:
    """Tests for the full comparison response with educational summary."""

    def test_response_has_gfm_advantage(self):
        """Response must include educational GFM advantage summary."""
        response = get_comparison_response(
            scenario="strong_grid",
            grid_ssc_mva=10_000.0,
        )
        assert len(response.gfm_advantage) > 0, "GFM advantage summary is empty"

    def test_response_scenario_populated(self):
        """Response scenario field must be populated."""
        response = get_comparison_response(scenario="test_scenario")
        assert response.scenario == "test_scenario"

    def test_response_has_both_results(self):
        """Response must contain both GFL and GFM results."""
        response = get_comparison_response(scenario="test")
        assert response.gfl_result.converter_type == ConverterType.GFL
        assert response.gfm_result.converter_type == ConverterType.GFM
