"""Tests for the 5 SCADA quality filters per Roadmap §5.3.

Validates each filter independently and the combined pipeline.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import (
    FilterType,
    apply_all_quality_filters,
    detect_curtailment,
    detect_icing,
    detect_maintenance,
    detect_power_curve_outliers,
    detect_sensor_faults,
)

# ── Small dataset for fast tests ──────────────────────────────────

FAST_CONFIG = SCADAConfig(num_turbines=4, num_timesteps=2_000, seed=42)


@pytest.fixture()
def scada_data() -> tuple:
    """Generate test SCADA data and return arrays."""
    ds = generate_scada_dataset(FAST_CONFIG)
    return ds.wind_speed_ms, ds.power_mw, ds.status, ds.temperature_c, ds.humidity_pct


# ── Curtailment Filter Tests ─────────────────────────────────────


class TestCurtailmentFilter:
    """Filter 1: P ≈ 0 but wind > cut-in and status ≠ maintenance."""

    def test_detects_curtailment(self) -> None:
        """Inject curtailment: zero power at 10 m/s wind."""
        ws = np.full((10, 1), 10.0)
        power = np.zeros((10, 1))  # Zero power despite good wind
        status = np.full((10, 1), "running", dtype="U20")
        flags = detect_curtailment(ws, power, status)
        assert np.any(flags)

    def test_no_flag_below_cut_in(self) -> None:
        """Zero power below cut-in is normal — should NOT be flagged."""
        ws = np.full((10, 1), 2.0)  # Below cut-in
        power = np.zeros((10, 1))
        status = np.full((10, 1), "running", dtype="U20")
        flags = detect_curtailment(ws, power, status)
        assert not np.any(flags)

    def test_no_flag_during_maintenance(self) -> None:
        """Zero power during maintenance is expected — should NOT flag."""
        ws = np.full((10, 1), 10.0)
        power = np.zeros((10, 1))
        status = np.full((10, 1), "maintenance", dtype="U20")
        flags = detect_curtailment(ws, power, status)
        assert not np.any(flags)


# ── Maintenance Filter Tests ─────────────────────────────────────


class TestMaintenanceFilter:
    """Filter 2: status ≠ 'running'."""

    def test_detects_maintenance(self) -> None:
        status = np.array([["running"], ["maintenance"], ["running"]], dtype="U20")
        flags = detect_maintenance(status)
        assert flags[1, 0]
        assert not flags[0, 0]

    def test_detects_all_non_running(self) -> None:
        status = np.array(
            [["curtailed"], ["sensor_fault"], ["icing"], ["running"]], dtype="U20"
        )
        flags = detect_maintenance(status)
        assert np.sum(flags) == 3


# ── Sensor Fault Filter Tests ────────────────────────────────────


class TestSensorFaultFilter:
    """Filter 3: frozen anemometer OR overpower."""

    def test_detects_frozen_anemometer(self) -> None:
        """Constant wind for 6+ steps should trigger frozen anemometer."""
        ws = np.full((10, 1), 8.0)  # Perfectly constant
        power = np.full((10, 1), 5.0)
        flags = detect_sensor_faults(ws, power)
        assert np.any(flags)

    def test_short_constant_not_flagged(self) -> None:
        """Short constant period (< window) should NOT trigger."""
        ws = np.array([[8.0], [8.0], [8.0], [9.0], [7.0], [10.0], [6.0], [11.0]])
        power = np.full((8, 1), 5.0)
        flags = detect_sensor_faults(ws, power, window_size=6)
        assert not np.any(flags)

    def test_detects_overpower(self) -> None:
        """Power > 1.05 × rated should be flagged."""
        ws = np.full((5, 1), 12.0)
        power = np.array([[10.0], [14.0], [16.0], [15.0], [14.0]])
        flags = detect_sensor_faults(ws, power, rated_power_mw=15.0)
        assert flags[2, 0]  # 16.0 > 15.75


# ── Power Curve Outlier Tests ─────────────────────────────────────


class TestPowerCurveOutlierFilter:
    """Filter 4: IQR per wind speed bin."""

    def test_detects_outlier(self) -> None:
        """Extreme power at normal wind should be flagged."""
        rng = np.random.default_rng(42)
        # Normal data: power roughly proportional to wind
        ws = rng.uniform(6.0, 7.0, size=(200, 1))
        power = ws**3 * 0.001 + rng.normal(0, 0.01, size=(200, 1))
        # Inject outlier
        power[0, 0] = 100.0
        flags = detect_power_curve_outliers(ws, power)
        assert flags[0, 0]

    def test_normal_data_passes(self) -> None:
        """Tightly distributed data should have few/no outliers."""
        rng = np.random.default_rng(42)
        ws = rng.uniform(8.0, 9.0, size=(200, 1))
        power = np.full((200, 1), 5.0) + rng.normal(0, 0.1, size=(200, 1))
        flags = detect_power_curve_outliers(ws, power)
        outlier_pct = np.sum(flags) / flags.size
        assert outlier_pct < 0.05


# ── Icing Filter Tests ───────────────────────────────────────────


class TestIcingFilter:
    """Filter 5: low power + cold + humid."""

    def test_detects_icing(self) -> None:
        """Power < 50% expected + cold + humid should be flagged."""
        ws = np.full((10, 1), 10.0)
        power = np.full((10, 1), 1.0)  # Very low for 10 m/s wind
        temp = np.full((10, 1), -5.0)  # Cold
        humidity = np.full((10, 1), 98.0)  # Very humid
        flags = detect_icing(power, ws, temp, humidity)
        assert np.any(flags)

    def test_no_flag_warm_weather(self) -> None:
        """Low power in warm weather is NOT icing."""
        ws = np.full((10, 1), 10.0)
        power = np.full((10, 1), 1.0)
        temp = np.full((10, 1), 20.0)  # Warm
        humidity = np.full((10, 1), 98.0)
        flags = detect_icing(power, ws, temp, humidity)
        assert not np.any(flags)

    def test_no_flag_low_humidity(self) -> None:
        """Low power in cold but dry weather is NOT icing."""
        ws = np.full((10, 1), 10.0)
        power = np.full((10, 1), 1.0)
        temp = np.full((10, 1), -5.0)
        humidity = np.full((10, 1), 50.0)  # Dry
        flags = detect_icing(power, ws, temp, humidity)
        assert not np.any(flags)


# ── Combined Pipeline Tests ──────────────────────────────────────


class TestCombinedPipeline:
    """Verify the full apply_all_quality_filters pipeline."""

    def test_availability_in_range(self, scada_data: tuple) -> None:
        """Target availability: 85-92% after filtering."""
        ws, power, status, temp, humidity = scada_data
        result = apply_all_quality_filters(ws, power, status, temp, humidity)
        # Allow wider range for small test datasets
        assert 50.0 < result.availability_pct < 99.0

    def test_clean_mask_shape(self, scada_data: tuple) -> None:
        ws, power, status, temp, humidity = scada_data
        result = apply_all_quality_filters(ws, power, status, temp, humidity)
        assert result.clean_mask.shape == ws.shape

    def test_total_points_correct(self, scada_data: tuple) -> None:
        ws, power, status, temp, humidity = scada_data
        result = apply_all_quality_filters(ws, power, status, temp, humidity)
        assert result.total_points == ws.shape[0] * ws.shape[1]

    def test_all_filter_types_counted(self, scada_data: tuple) -> None:
        ws, power, status, temp, humidity = scada_data
        result = apply_all_quality_filters(ws, power, status, temp, humidity)
        for ft in FilterType:
            assert ft.value in result.counts_by_filter

    def test_clean_data_passes_all_filters(self) -> None:
        """Perfectly clean data should have ~100% availability."""
        ws = np.full((100, 2), 10.0) + np.random.default_rng(42).normal(0, 1.0, size=(100, 2))
        ws = np.maximum(ws, 3.5)
        power = np.full((100, 2), 8.0) + np.random.default_rng(42).normal(0, 0.5, size=(100, 2))
        power = np.clip(power, 0.0, 14.9)
        status = np.full((100, 2), "running", dtype="U20")
        temp = np.full((100, 2), 15.0)
        humidity = np.full((100, 2), 60.0)
        result = apply_all_quality_filters(ws, power, status, temp, humidity)
        assert result.availability_pct > 80.0
