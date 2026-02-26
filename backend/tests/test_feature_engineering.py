"""Tests for physical feature engineering pipeline.

Validates rolling statistics, cyclical encoding, lag features,
and the no-future-leakage guarantee.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.feature_engineering import (
    compute_air_density_array,
    compute_cyclical_time_features,
    compute_power_lags,
    compute_rolling_stats,
    compute_turbulence_intensity,
    compute_wake_direction_indicator,
    compute_wind_direction_change_rate,
    engineer_features,
)
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters

# ── Rolling Statistics Tests ──────────────────────────────────────


class TestRollingStats:
    """Verify rolling mean and standard deviation."""

    def test_rolling_mean_correct(self) -> None:
        values = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
        mean, _std = compute_rolling_stats(values, window=3)
        # First 2 elements should be NaN
        assert np.isnan(mean[0])
        assert np.isnan(mean[1])
        # Third element: mean(1,2,3) = 2.0
        assert mean[2] == pytest.approx(2.0)
        # Fourth element: mean(2,3,4) = 3.0
        assert mean[3] == pytest.approx(3.0)

    def test_rolling_std_constant_is_zero(self) -> None:
        values = np.array([5.0, 5.0, 5.0, 5.0, 5.0, 5.0])
        _, std = compute_rolling_stats(values, window=3)
        assert std[2] == pytest.approx(0.0)

    def test_nan_at_start(self) -> None:
        values = np.arange(10, dtype=np.float64)
        mean, _std = compute_rolling_stats(values, window=6)
        assert np.all(np.isnan(mean[:5]))
        assert not np.isnan(mean[5])


# ── Turbulence Intensity Tests ────────────────────────────────────


class TestTurbulenceIntensity:
    """Verify IEC 61400-1 TI = σ / μ."""

    def test_ti_calculation(self) -> None:
        ws_mean = np.array([10.0, 10.0, 10.0])
        ws_std = np.array([1.0, 2.0, 0.5])
        ti = compute_turbulence_intensity(ws_mean, ws_std)
        assert ti[0] == pytest.approx(0.1)
        assert ti[1] == pytest.approx(0.2)
        assert ti[2] == pytest.approx(0.05)

    def test_ti_zero_at_low_wind(self) -> None:
        ws_mean = np.array([0.1])
        ws_std = np.array([0.5])
        ti = compute_turbulence_intensity(ws_mean, ws_std, min_wind=0.5)
        assert ti[0] == 0.0

    def test_ti_preserves_nan(self) -> None:
        ws_mean = np.array([np.nan, 10.0])
        ws_std = np.array([np.nan, 1.0])
        ti = compute_turbulence_intensity(ws_mean, ws_std)
        assert np.isnan(ti[0])
        assert not np.isnan(ti[1])


# ── Wind Direction Change Rate Tests ─────────────────────────────


class TestWindDirectionChange:
    """Verify wrap-around handling for wind direction."""

    def test_simple_change(self) -> None:
        wd = np.array([100.0, 110.0, 115.0])
        rate = compute_wind_direction_change_rate(wd)
        assert np.isnan(rate[0])  # First element has no predecessor
        assert rate[1] == pytest.approx(10.0)
        assert rate[2] == pytest.approx(5.0)

    def test_wraparound_360_to_0(self) -> None:
        """350° → 10° should be 20°, not 340°."""
        wd = np.array([350.0, 10.0])
        rate = compute_wind_direction_change_rate(wd)
        assert rate[1] == pytest.approx(20.0)

    def test_wraparound_0_to_350(self) -> None:
        """10° → 350° should be 20°, not 340°."""
        wd = np.array([10.0, 350.0])
        rate = compute_wind_direction_change_rate(wd)
        assert rate[1] == pytest.approx(20.0)


# ── Cyclical Encoding Tests ──────────────────────────────────────


class TestCyclicalEncoding:
    """Verify sin²(x) + cos²(x) = 1 property."""

    def test_sin_cos_identity(self) -> None:
        """sin²(hour) + cos²(hour) = 1 for all timestamps."""
        timestamps = np.arange(1_704_067_200, 1_704_067_200 + 86400, 600, dtype=np.int64)
        h_sin, h_cos, m_sin, m_cos = compute_cyclical_time_features(timestamps)
        # sin² + cos² should equal 1
        hour_sum = h_sin**2 + h_cos**2
        np.testing.assert_array_almost_equal(hour_sum, 1.0)
        month_sum = m_sin**2 + m_cos**2
        np.testing.assert_array_almost_equal(month_sum, 1.0)

    def test_values_in_range(self) -> None:
        timestamps = np.array([1_704_067_200], dtype=np.int64)
        h_sin, h_cos, m_sin, m_cos = compute_cyclical_time_features(timestamps)
        for val in [h_sin[0], h_cos[0], m_sin[0], m_cos[0]]:
            assert -1.0 <= val <= 1.0


# ── Power Lag Tests ───────────────────────────────────────────────


class TestPowerLags:
    """Verify lag features match temporal order with no leakage."""

    def test_lag_values_correct(self) -> None:
        power = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
        lags = compute_power_lags(power, num_lags=2)
        # lag_1: P(t-1)
        assert np.isnan(lags[0, 0])  # No predecessor for first
        assert lags[1, 0] == 10.0  # P(t-1) = 10
        assert lags[2, 0] == 20.0  # P(t-1) = 20
        # lag_2: P(t-2)
        assert np.isnan(lags[0, 1])
        assert np.isnan(lags[1, 1])
        assert lags[2, 1] == 10.0  # P(t-2) = 10

    def test_no_future_leakage(self) -> None:
        """Lag features should only look backward, never forward."""
        power = np.arange(100, dtype=np.float64)
        lags = compute_power_lags(power, num_lags=6)
        # First 6 rows should have at least one NaN
        for t in range(6):
            assert np.any(np.isnan(lags[t]))
        # From row 6 onward, no NaN
        assert not np.any(np.isnan(lags[6:]))

    def test_lag_shape(self) -> None:
        power = np.arange(50, dtype=np.float64)
        lags = compute_power_lags(power, num_lags=4)
        assert lags.shape == (50, 4)


# ── Wake Direction Indicator Tests ────────────────────────────────


class TestWakeIndicator:
    """Verify cos(wd - alignment) behavior."""

    def test_aligned_is_one(self) -> None:
        """Wind from farm alignment direction → cos(0) = 1."""
        wd = np.array([210.0])
        indicator = compute_wake_direction_indicator(wd, farm_alignment_deg=210.0)
        assert indicator[0] == pytest.approx(1.0)

    def test_perpendicular_is_zero(self) -> None:
        """Wind 90° off alignment → cos(90°) = 0."""
        wd = np.array([300.0])
        indicator = compute_wake_direction_indicator(wd, farm_alignment_deg=210.0)
        assert abs(indicator[0]) < 0.01


# ── Air Density Array Tests ──────────────────────────────────────


class TestAirDensityArray:
    """Verify array-based air density computation."""

    def test_standard_conditions(self) -> None:
        pressure = np.array([101325.0])
        temp = np.array([15.0])  # °C
        rho = compute_air_density_array(pressure, temp)
        assert rho[0] == pytest.approx(1.225, abs=0.001)

    def test_cold_increases_density(self) -> None:
        pressure = np.array([101325.0, 101325.0])
        temp = np.array([15.0, -10.0])
        rho = compute_air_density_array(pressure, temp)
        assert rho[1] > rho[0]


# ── Full Pipeline Integration Test ───────────────────────────────


class TestFullPipeline:
    """End-to-end feature engineering test."""

    def test_no_nan_in_output(self) -> None:
        """Feature matrix should have zero NaN after pipeline."""
        config = SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
        ds = generate_scada_dataset(config)
        fr = apply_all_quality_filters(
            ds.wind_speed_ms,
            ds.power_mw,
            ds.status,
            ds.temperature_c,
            ds.humidity_pct,
        )
        features = engineer_features(
            wind_speed=ds.wind_speed_ms,
            power=ds.power_mw,
            wind_direction=ds.wind_direction_deg,
            temperature=ds.temperature_c,
            pressure=ds.pressure_pa,
            humidity=ds.humidity_pct,
            timestamps=ds.timestamps,
            clean_mask=fr.clean_mask,
            turbine_index=0,
        )
        assert not np.any(np.isnan(features.feature_matrix))

    def test_feature_matrix_shape(self) -> None:
        config = SCADAConfig(num_turbines=2, num_timesteps=500, seed=42)
        ds = generate_scada_dataset(config)
        fr = apply_all_quality_filters(
            ds.wind_speed_ms,
            ds.power_mw,
            ds.status,
            ds.temperature_c,
            ds.humidity_pct,
        )
        features = engineer_features(
            wind_speed=ds.wind_speed_ms,
            power=ds.power_mw,
            wind_direction=ds.wind_direction_deg,
            temperature=ds.temperature_c,
            pressure=ds.pressure_pa,
            humidity=ds.humidity_pct,
            timestamps=ds.timestamps,
            clean_mask=fr.clean_mask,
            turbine_index=0,
        )
        # 14 base features + 6 lag features = 20
        assert features.feature_matrix.shape[1] == 20
        assert len(features.feature_names) == 20
        assert features.valid_timesteps == features.feature_matrix.shape[0]
        assert features.dropped_timesteps >= 0
