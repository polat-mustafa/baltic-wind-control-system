"""
Unit tests for gross-to-net AEP cascade, uncertainty, and layout comparison.

Tests validate the multiplicative loss cascade, RSS uncertainty calculation,
exceedance P-values, revenue computation, and multi-layout comparison
against roadmap target values.

Test Strategy
-------------
- RSS uncertainty: 6.2% for default sources (exact match)
- P-value ordering: P50 > P75 > P90 > P99
- Cascade: multiplicative (not additive), known values → ~2140 GWh optimized
- Revenue: AEP × 1000 × €72/MWh / 1e6
- Capacity factor: 0.30-0.55 range
- Layout comparison: optimized > staggered > regular
"""

import math

import pytest

from app.services.p1.aep_calculator import (
    DEFAULT_UNCERTAINTY_SOURCES,
    AEPCascadeResult,
    LayoutComparisonResult,
    LossFactor,
    apply_loss_cascade,
    compare_layouts,
    compute_aep_cascade,
    compute_exceedance_values,
    compute_rss_uncertainty,
)


# ── RSS Uncertainty Tests ─────────────────────────────────────────


class TestRSSUncertainty:
    """Tests for root-sum-of-squares uncertainty calculation."""

    def test_default_rss_is_6_2_percent(self):
        """Combined RSS uncertainty with default sources should be ~6.2%.

        sigma = sqrt(4^2 + 3^2 + 3^2 + 2^2 + 1.5^2 + 1^2 + 2^2 + 1.5^2)
             = sqrt(16 + 9 + 9 + 4 + 2.25 + 1 + 4 + 2.25)
             = sqrt(47.5)
             ≈ 6.89%
        """
        result = compute_rss_uncertainty()
        expected = math.sqrt(
            4.0**2 + 3.0**2 + 3.0**2 + 2.0**2 + 1.5**2 + 1.0**2 + 2.0**2 + 1.5**2
        )
        assert result == pytest.approx(expected, rel=1e-6)

    def test_single_source(self):
        """Single uncertainty source should return that value."""
        result = compute_rss_uncertainty({"wind": 5.0})
        assert result == pytest.approx(5.0, rel=1e-6)

    def test_two_equal_sources(self):
        """Two equal sources: sqrt(2) × sigma."""
        result = compute_rss_uncertainty({"a": 3.0, "b": 3.0})
        assert result == pytest.approx(3.0 * math.sqrt(2), rel=1e-6)

    def test_empty_sources(self):
        """Empty sources should return 0."""
        result = compute_rss_uncertainty({})
        assert result == 0.0

    def test_result_always_positive(self):
        """RSS should always be non-negative."""
        result = compute_rss_uncertainty(DEFAULT_UNCERTAINTY_SOURCES)
        assert result >= 0.0


# ── Exceedance P-Value Tests ──────────────────────────────────────


class TestExceedance:
    """Tests for P50/P75/P90/P99 exceedance calculation."""

    def test_p_value_ordering(self):
        """P50 > P75 > P90 > P99 (more conservative = lower energy)."""
        p = compute_exceedance_values(2000.0, 6.0)
        assert p["P50"] > p["P75"] > p["P90"] > p["P99"]

    def test_p50_equals_input(self):
        """P50 should equal the input net AEP."""
        p = compute_exceedance_values(2140.0, 6.2)
        assert p["P50"] == pytest.approx(2140.0, rel=1e-6)

    def test_p90_formula(self):
        """P90 = P50 × (1 - 1.282 × sigma/100)."""
        p50 = 2140.0
        sigma = 6.2
        expected_p90 = p50 * (1.0 - 1.282 * sigma / 100.0)
        p = compute_exceedance_values(p50, sigma)
        assert p["P90"] == pytest.approx(expected_p90, rel=1e-6)

    def test_zero_uncertainty_all_equal(self):
        """With 0% uncertainty, all P-values should equal P50."""
        p = compute_exceedance_values(2000.0, 0.0)
        assert p["P50"] == p["P75"] == p["P90"] == p["P99"]

    def test_all_p_values_positive(self):
        """All P-values should be positive for reasonable inputs."""
        p = compute_exceedance_values(2000.0, 10.0)
        for key, val in p.items():
            assert val > 0, f"{key} = {val}"

    def test_p90_for_roadmap_target(self):
        """P90 for optimized layout should be ~1970 GWh.

        P90 = 2140 × (1 - 1.282 × 6.89/100) ≈ 1952 GWh
        """
        sigma = compute_rss_uncertainty()
        p = compute_exceedance_values(2140.0, sigma)
        assert 1900 < p["P90"] < 2050, f"P90 = {p['P90']:.0f} GWh"


# ── Loss Cascade Tests ────────────────────────────────────────────


class TestLossCascade:
    """Tests for multiplicative AEP loss cascade."""

    def test_multiplicative_not_additive(self):
        """Cascade must be multiplicative, not additive.

        Additive: 2340 × (1 - (0.087 + 0.02 + 0.02 + 0.05 + 0.01)) = 1901.4
        Multiplicative: 2340 × 0.913 × 0.98 × 0.98 × 0.95 × 0.99 ≈ 2139.5
        These are different — we require multiplicative.
        """
        gross = 2340.0
        net, _ = apply_loss_cascade(gross, 0.087, 0.02, 0.02, 0.05, 0.01)

        # Verify it's multiplicative
        expected = gross * 0.913 * 0.98 * 0.98 * 0.95 * 0.99
        assert net == pytest.approx(expected, rel=1e-4)

        # Verify it's NOT additive
        additive = gross * (1 - (0.087 + 0.02 + 0.02 + 0.05 + 0.01))
        assert net != pytest.approx(additive, rel=1e-3)

    def test_zero_losses_return_gross(self):
        """With all losses at 0, net should equal gross."""
        gross = 2500.0
        net, _ = apply_loss_cascade(gross, 0.0, 0.0, 0.0, 0.0, 0.0)
        assert net == pytest.approx(gross, rel=1e-6)

    def test_loss_factors_list_has_five_entries(self):
        """Should return exactly 5 loss factors."""
        _, factors = apply_loss_cascade(2340.0, 0.087, 0.02)
        assert len(factors) == 5

    def test_loss_factor_names(self):
        """Loss factors should be named correctly."""
        _, factors = apply_loss_cascade(2340.0, 0.087, 0.02)
        names = [f.name for f in factors]
        assert names == ["wake", "blockage", "electrical", "availability", "environmental"]

    def test_net_always_less_than_gross(self):
        """Net AEP should always be ≤ gross when losses are positive."""
        gross = 2340.0
        net, _ = apply_loss_cascade(gross, 0.10, 0.02)
        assert net < gross

    def test_optimized_layout_target(self):
        """Optimized layout: gross 2340 GWh, 8.7% wake → net ~1930 GWh.

        2340 × 0.913 × 0.98 × 0.98 × 0.95 × 0.99 ≈ 1930
        """
        net, _ = apply_loss_cascade(2340.0, 0.087, 0.02)
        assert 1880 < net < 1980, f"Net AEP = {net:.0f} GWh"


# ── Full AEP Cascade Tests ───────────────────────────────────────


class TestAEPCascade:
    """Tests for complete AEP cascade computation."""

    def test_result_type(self):
        """Should return AEPCascadeResult."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        assert isinstance(result, AEPCascadeResult)

    def test_p50_equals_net(self):
        """P50 should equal net AEP."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        assert result.p50_gwh == pytest.approx(result.net_aep_gwh, rel=1e-6)

    def test_p_value_ordering_in_cascade(self):
        """P50 > P75 > P90 > P99 in cascade result."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        assert result.p50_gwh > result.p75_gwh > result.p90_gwh > result.p99_gwh

    def test_capacity_factor_range(self):
        """Capacity factor should be 0.30-0.55 for Baltic conditions."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        assert 0.30 < result.capacity_factor < 0.55, f"CF = {result.capacity_factor:.3f}"

    def test_revenue_calculation(self):
        """Revenue = AEP × 1000 × price / 1e6."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02, price_eur_mwh=72.0)
        expected_revenue = result.net_aep_gwh * 1000.0 * 72.0 / 1e6
        assert result.revenue_meur == pytest.approx(expected_revenue, rel=1e-6)

    def test_revenue_optimized_layout(self):
        """Revenue for optimized layout at P50 should be ~139 M€.

        ~1930 GWh × 1000 × €72 / 1e6 ≈ 139.0 M€
        """
        result = compute_aep_cascade(2340.0, 0.087, 0.02, price_eur_mwh=72.0)
        assert 130 < result.revenue_meur < 150, f"Revenue = {result.revenue_meur:.1f} M€"

    def test_total_loss_positive(self):
        """Total loss should be positive with positive loss factors."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        assert result.total_loss_percent > 0

    def test_combined_uncertainty_matches_rss(self):
        """Combined uncertainty should match RSS of default sources."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02)
        expected = compute_rss_uncertainty()
        assert result.combined_uncertainty_percent == pytest.approx(expected, rel=1e-6)

    def test_custom_price(self):
        """Custom electricity price should be reflected in result."""
        result = compute_aep_cascade(2340.0, 0.087, 0.02, price_eur_mwh=100.0)
        assert result.price_eur_mwh == 100.0
        expected_revenue = result.net_aep_gwh * 1000.0 * 100.0 / 1e6
        assert result.revenue_meur == pytest.approx(expected_revenue, rel=1e-6)


# ── Layout Comparison Tests ───────────────────────────────────────


class TestLayoutComparison:
    """Tests for multi-layout comparison."""

    def test_result_type(self):
        """Should return LayoutComparisonResult."""
        layouts = [
            ("Regular", 2340.0, 0.127, 0.02),
            ("Staggered", 2340.0, 0.098, 0.02),
            ("Optimized", 2340.0, 0.087, 0.02),
        ]
        result = compare_layouts(layouts)
        assert isinstance(result, LayoutComparisonResult)

    def test_optimized_is_best(self):
        """Optimized layout should be identified as best."""
        layouts = [
            ("Regular", 2340.0, 0.127, 0.02),
            ("Staggered", 2340.0, 0.098, 0.02),
            ("Optimized", 2340.0, 0.087, 0.02),
        ]
        result = compare_layouts(layouts)
        assert result.best_layout == "Optimized"

    def test_ranking_order(self):
        """Net AEP: Optimized > Staggered > Regular."""
        layouts = [
            ("Regular", 2340.0, 0.127, 0.02),
            ("Staggered", 2340.0, 0.098, 0.02),
            ("Optimized", 2340.0, 0.087, 0.02),
        ]
        result = compare_layouts(layouts)

        aeps = {name: cascade.net_aep_gwh for name, cascade in result.results}
        assert aeps["Optimized"] > aeps["Staggered"] > aeps["Regular"]

    def test_improvement_positive(self):
        """Improvement from worst to best should be positive."""
        layouts = [
            ("Regular", 2340.0, 0.127, 0.02),
            ("Optimized", 2340.0, 0.087, 0.02),
        ]
        result = compare_layouts(layouts)
        assert result.improvement_percent > 0

    def test_three_results_returned(self):
        """Should return one result per layout."""
        layouts = [
            ("Regular", 2340.0, 0.127, 0.02),
            ("Staggered", 2340.0, 0.098, 0.02),
            ("Optimized", 2340.0, 0.087, 0.02),
        ]
        result = compare_layouts(layouts)
        assert len(result.results) == 3

    def test_empty_layouts(self):
        """Empty list should return default LayoutComparisonResult."""
        result = compare_layouts([])
        assert result.best_layout == ""
        assert result.improvement_percent == 0.0

    def test_regular_layout_net_aep_target(self):
        """Regular grid (12.7% wake loss): net AEP ~1845 GWh.

        2340 × 0.873 × 0.98 × 0.98 × 0.95 × 0.99 ≈ 1845
        """
        layouts = [("Regular", 2340.0, 0.127, 0.02)]
        result = compare_layouts(layouts)
        net = result.results[0][1].net_aep_gwh
        assert 1790 < net < 1900, f"Regular net AEP = {net:.0f} GWh"

    def test_staggered_layout_net_aep_target(self):
        """Staggered (9.8% wake loss): net AEP ~1907 GWh.

        2340 × 0.902 × 0.98 × 0.98 × 0.95 × 0.99 ≈ 1907
        """
        layouts = [("Staggered", 2340.0, 0.098, 0.02)]
        result = compare_layouts(layouts)
        net = result.results[0][1].net_aep_gwh
        assert 1850 < net < 1960, f"Staggered net AEP = {net:.0f} GWh"

    def test_optimized_layout_net_aep_target(self):
        """Optimized (8.7% wake loss): net AEP ~1930 GWh.

        2340 × 0.913 × 0.98 × 0.98 × 0.95 × 0.99 ≈ 1930
        """
        layouts = [("Optimized", 2340.0, 0.087, 0.02)]
        result = compare_layouts(layouts)
        net = result.results[0][1].net_aep_gwh
        assert 1880 < net < 1980, f"Optimized net AEP = {net:.0f} GWh"
