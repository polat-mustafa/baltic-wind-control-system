"""
Unit tests for V236-15.0 MW turbine curves and PyWake wake model.

Tests validate the power and thrust coefficient curves against physical
constraints (Rule 1), and the PyWake integration against expected AEP
and wake loss ranges for Baltic Sea conditions.

Test Strategy
-------------
- Power curve: cut-in/rated/cut-out behavior, P ≥ 0, P ≤ rated, monotonic
- Ct curve: 0 ≤ Ct ≤ 1, Ct ≈ 0.28 at rated, zero outside operating range
- Wake model (PyWake): single turbine AEP ~63-70 GWh, two-turbine downstream
  lower, wake loss 5-15%, capacity factor 0.30-0.55
"""

import numpy as np
import pytest

from app.services.p1.wake_model import (
    CUT_IN_SPEED_MS,
    RATED_POWER_KW,
    RATED_SPEED_MS,
    ROTOR_DIAMETER_M,
    get_v236_ct_curve,
    get_v236_power_curve_kw,
)

# Check if PyWake is available for integration tests
try:
    import py_wake  # noqa: F401

    HAS_PYWAKE = True
except ImportError:
    HAS_PYWAKE = False


# ── Power Curve Tests ──────────────────────────────────────────────


class TestPowerCurve:
    """Tests for V236-15.0 MW power curve (Rule 1 compliance)."""

    def test_zero_power_below_cut_in(self):
        """Power must be 0 below cut-in speed (3 m/s)."""
        speeds = np.array([0.0, 1.0, 2.0, 2.9])
        power = get_v236_power_curve_kw(speeds)
        np.testing.assert_array_equal(power, 0.0)

    def test_zero_power_above_cut_out(self):
        """Power must be 0 above cut-out speed (31 m/s)."""
        speeds = np.array([31.1, 35.0, 50.0])
        power = get_v236_power_curve_kw(speeds)
        np.testing.assert_array_equal(power, 0.0)

    def test_rated_power_at_rated_speed(self):
        """Power should reach rated (15,000 kW) at rated speed (12.5 m/s)."""
        speeds = np.array([RATED_SPEED_MS])
        power = get_v236_power_curve_kw(speeds)
        assert power[0] == pytest.approx(RATED_POWER_KW, abs=100)

    def test_rated_power_between_rated_and_cutout(self):
        """Power should stay at rated between rated speed and cut-out."""
        speeds = np.array([13.0, 15.0, 20.0, 25.0, 30.0])
        power = get_v236_power_curve_kw(speeds)
        for p in power:
            assert p == pytest.approx(RATED_POWER_KW, abs=100)

    def test_power_never_negative(self):
        """Rule 1: Power must always be ≥ 0."""
        speeds = np.linspace(-5, 50, 1000)
        power = get_v236_power_curve_kw(speeds)
        assert np.all(power >= 0.0)

    def test_power_never_exceeds_rated(self):
        """Rule 1: Power must always be ≤ P_rated."""
        speeds = np.linspace(0, 50, 1000)
        power = get_v236_power_curve_kw(speeds)
        assert np.all(power <= RATED_POWER_KW)

    def test_power_monotonic_below_rated(self):
        """Power should increase monotonically from cut-in to rated speed."""
        speeds = np.linspace(CUT_IN_SPEED_MS, RATED_SPEED_MS, 100)
        power = get_v236_power_curve_kw(speeds)
        diffs = np.diff(power)
        assert np.all(diffs >= -1.0), "Power curve not monotonically increasing"

    def test_partial_load_at_half_rated(self):
        """Power at ~8 m/s should be partial load (~40-45% of rated)."""
        speeds = np.array([8.0])
        power = get_v236_power_curve_kw(speeds)
        assert 4000 < power[0] < 8000, f"Power at 8 m/s = {power[0]} kW"


# ── Thrust Coefficient Curve Tests ─────────────────────────────────


class TestCtCurve:
    """Tests for V236-15.0 MW thrust coefficient curve."""

    def test_ct_in_valid_range(self):
        """Ct must be in [0, 1] across all speeds."""
        speeds = np.linspace(0, 50, 1000)
        ct = get_v236_ct_curve(speeds)
        assert np.all(ct >= 0.0)
        assert np.all(ct <= 1.0)

    def test_ct_near_rated_speed(self):
        """Ct at rated speed should be approximately 0.28."""
        speeds = np.array([RATED_SPEED_MS])
        ct = get_v236_ct_curve(speeds)
        assert ct[0] == pytest.approx(0.28, abs=0.05)

    def test_ct_zero_below_cut_in(self):
        """Ct must be 0 below cut-in speed."""
        speeds = np.array([0.0, 1.0, 2.0, 2.9])
        ct = get_v236_ct_curve(speeds)
        np.testing.assert_array_equal(ct, 0.0)

    def test_ct_zero_above_cut_out(self):
        """Ct must be 0 above cut-out speed."""
        speeds = np.array([31.1, 35.0, 50.0])
        ct = get_v236_ct_curve(speeds)
        np.testing.assert_array_equal(ct, 0.0)

    def test_ct_high_near_cut_in(self):
        """Ct should be highest near cut-in (typical: 0.8-0.9)."""
        speeds = np.array([3.5])
        ct = get_v236_ct_curve(speeds)
        assert ct[0] > 0.7, f"Ct near cut-in = {ct[0]}"

    def test_ct_decreases_with_speed(self):
        """Ct should generally decrease from cut-in to rated speed."""
        speeds = np.array([4.0, 8.0, 12.5])
        ct = get_v236_ct_curve(speeds)
        assert ct[0] > ct[1] > ct[2]


# ── PyWake Integration Tests ──────────────────────────────────────


@pytest.mark.skipif(not HAS_PYWAKE, reason="PyWake not installed")
class TestWakeModel:
    """Integration tests for PyWake wake model (requires py-wake)."""

    def test_single_turbine_aep(self):
        """Single turbine AEP should be ~63-70 GWh for Baltic conditions."""
        from app.services.p1.wake_model import (
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site(weibull_a_ms=10.5, weibull_k=2.2)
        turbine = create_v236_wind_turbine()
        x = np.array([0.0])
        y = np.array([0.0])

        result = run_wake_analysis(x, y, site, turbine)

        assert 55.0 < result.net_aep_gwh < 80.0, (
            f"Single turbine AEP = {result.net_aep_gwh:.1f} GWh"
        )

    def test_single_turbine_no_wake_loss(self):
        """Single turbine should have ~0% wake loss."""
        from app.services.p1.wake_model import (
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site()
        turbine = create_v236_wind_turbine()
        result = run_wake_analysis(np.array([0.0]), np.array([0.0]), site, turbine)

        assert result.wake_loss_percent == pytest.approx(0.0, abs=0.5)

    def test_two_turbine_downstream_lower(self):
        """Downstream turbine should produce less than upstream (wake effect)."""
        from app.services.p1.wake_model import (
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site()
        turbine = create_v236_wind_turbine()
        # Two turbines aligned E-W, 5D apart
        spacing = 5 * ROTOR_DIAMETER_M
        x = np.array([0.0, spacing])
        y = np.array([0.0, 0.0])

        result = run_wake_analysis(x, y, site, turbine)

        # Wake loss should be positive
        assert result.wake_loss_percent > 0.5, f"Wake loss = {result.wake_loss_percent:.1f}%"

    def test_wake_loss_range(self):
        """Wake loss for two turbines at 5D should be positive but moderate.

        With uniform omnidirectional wind, only a fraction of directions
        align the turbines, so overall wake loss is ~0.5-5%.
        """
        from app.services.p1.wake_model import (
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site()
        turbine = create_v236_wind_turbine()
        spacing = 5 * ROTOR_DIAMETER_M
        x = np.array([0.0, spacing])
        y = np.array([0.0, 0.0])

        result = run_wake_analysis(x, y, site, turbine)

        assert 0.3 < result.wake_loss_percent < 5.0, f"Wake loss = {result.wake_loss_percent:.1f}%"

    def test_capacity_factor_range(self):
        """Capacity factor should be 0.30-0.55 for Baltic conditions."""
        from app.services.p1.wake_model import (
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site(weibull_a_ms=10.5, weibull_k=2.2)
        turbine = create_v236_wind_turbine()
        result = run_wake_analysis(np.array([0.0]), np.array([0.0]), site, turbine)

        assert 0.30 < result.capacity_factor < 0.55, f"CF = {result.capacity_factor:.3f}"

    def test_result_structure(self):
        """WakeAnalysisResult should have correct fields and shapes."""
        from app.services.p1.wake_model import (
            WakeAnalysisResult,
            create_uniform_site,
            create_v236_wind_turbine,
            run_wake_analysis,
        )

        site = create_uniform_site()
        turbine = create_v236_wind_turbine()
        x = np.array([0.0, 1000.0])
        y = np.array([0.0, 0.0])

        result = run_wake_analysis(x, y, site, turbine)

        assert isinstance(result, WakeAnalysisResult)
        assert result.gross_aep_gwh > 0
        assert result.net_aep_gwh > 0
        assert result.net_aep_gwh <= result.gross_aep_gwh
        assert len(result.per_turbine_aep_gwh) == 2
        assert len(result.per_turbine_wake_loss_percent) == 2

    def test_create_site_from_wind_rose(self):
        """Creating a site from WindRoseResult should work with wake analysis."""
        from app.services.p1.wake_model import (
            create_site_from_wind_rose,
            create_v236_wind_turbine,
            run_wake_analysis,
        )
        from app.services.p1.wind_analysis import compute_wind_rose

        # Generate synthetic data
        rng = np.random.default_rng(42)
        speeds = rng.weibull(2.2, 50000) * 10.5
        directions = rng.uniform(0, 360, 50000)

        wind_rose = compute_wind_rose(speeds.astype(np.float64), directions.astype(np.float64))
        site = create_site_from_wind_rose(wind_rose)
        turbine = create_v236_wind_turbine()

        result = run_wake_analysis(np.array([0.0]), np.array([0.0]), site, turbine)

        assert result.net_aep_gwh > 0
        assert result.capacity_factor > 0
