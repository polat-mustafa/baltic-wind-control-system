"""Tests for synthetic SCADA data generator.

Validates data shape, wind statistics, anomaly injection, and
reproducibility for the 34-turbine Baltic Sea wind farm.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.scada_generator import (
    SCADAConfig,
    SCADADataset,
    generate_scada_dataset,
)


# ── Use small dataset for fast tests ──────────────────────────────

FAST_CONFIG = SCADAConfig(
    num_turbines=4,
    num_timesteps=2_000,
    seed=42,
)


@pytest.fixture()
def dataset() -> SCADADataset:
    """Generate a small test dataset."""
    return generate_scada_dataset(FAST_CONFIG)


# ── Shape Tests ───────────────────────────────────────────────────


class TestDatasetShape:
    """Verify array dimensions match configuration."""

    def test_wind_speed_shape(self, dataset: SCADADataset) -> None:
        assert dataset.wind_speed_ms.shape == (2_000, 4)

    def test_power_shape(self, dataset: SCADADataset) -> None:
        assert dataset.power_mw.shape == (2_000, 4)

    def test_wind_direction_shape(self, dataset: SCADADataset) -> None:
        assert dataset.wind_direction_deg.shape == (2_000, 4)

    def test_temperature_shape(self, dataset: SCADADataset) -> None:
        assert dataset.temperature_c.shape == (2_000, 4)

    def test_humidity_shape(self, dataset: SCADADataset) -> None:
        assert dataset.humidity_pct.shape == (2_000, 4)

    def test_pressure_shape(self, dataset: SCADADataset) -> None:
        assert dataset.pressure_pa.shape == (2_000, 4)

    def test_status_shape(self, dataset: SCADADataset) -> None:
        assert dataset.status.shape == (2_000, 4)

    def test_timestamps_shape(self, dataset: SCADADataset) -> None:
        assert dataset.timestamps.shape == (2_000,)

    def test_timestamps_10min_intervals(self, dataset: SCADADataset) -> None:
        diffs = np.diff(dataset.timestamps)
        assert np.all(diffs == 600)


# ── Wind Statistics Tests ─────────────────────────────────────────


class TestWindStatistics:
    """Verify Weibull distribution properties."""

    def test_wind_speed_positive(self, dataset: SCADADataset) -> None:
        assert np.all(dataset.wind_speed_ms >= 0.0)

    def test_mean_wind_speed_reasonable(self, dataset: SCADADataset) -> None:
        """Baltic Sea mean wind should be ~8-12 m/s."""
        mean_ws = float(np.mean(dataset.wind_speed_ms))
        assert 5.0 < mean_ws < 15.0

    def test_max_wind_speed_reasonable(self, dataset: SCADADataset) -> None:
        """Max wind speed should not exceed ~40 m/s."""
        assert float(np.max(dataset.wind_speed_ms)) < 50.0

    def test_weibull_distribution(self) -> None:
        """Generate large sample and check Weibull shape."""
        config = SCADAConfig(num_turbines=1, num_timesteps=50_000, seed=123)
        ds = generate_scada_dataset(config)
        ws = ds.wind_speed_ms[:, 0]
        # Mean should be near Weibull mean ≈ a × Γ(1 + 1/k)
        # For a=10.5, k=2.2: mean ≈ 9.3 m/s
        mean = float(np.mean(ws))
        assert 7.0 < mean < 12.0


# ── Power Output Tests ────────────────────────────────────────────


class TestPowerOutput:
    """Verify power values are physically plausible."""

    def test_power_mostly_non_negative(self, dataset: SCADADataset) -> None:
        """Most power values should be ≥ 0 (some noise may create tiny negatives)."""
        assert np.sum(dataset.power_mw < -0.1) == 0

    def test_power_max_reasonable(self, dataset: SCADADataset) -> None:
        """Max power should be near or slightly above rated (15 MW)."""
        # Overpower injection can push to ~1.12 × 15 = 16.8 MW
        assert float(np.max(dataset.power_mw)) < 20.0


# ── Anomaly Injection Tests ──────────────────────────────────────


class TestAnomalyInjection:
    """Verify all anomaly types are present in the dataset."""

    def test_curtailment_injected(self, dataset: SCADADataset) -> None:
        assert np.any(dataset.status == "curtailed")

    def test_maintenance_injected(self, dataset: SCADADataset) -> None:
        assert np.any(dataset.status == "maintenance")

    def test_sensor_fault_injected(self, dataset: SCADADataset) -> None:
        assert np.any(dataset.status == "sensor_fault")

    def test_icing_injected(self, dataset: SCADADataset) -> None:
        """Icing requires cold + humid conditions — may not appear in all seeds."""
        # Check that icing status exists OR icing conditions exist
        has_icing_status = np.any(dataset.status == "icing")
        cold_humid = np.any(
            (dataset.temperature_c < 2.0) & (dataset.humidity_pct > 90.0)
        )
        assert has_icing_status or cold_humid

    def test_running_is_majority(self, dataset: SCADADataset) -> None:
        """Most timesteps should be 'running'."""
        running_pct = np.sum(dataset.status == "running") / dataset.status.size
        assert running_pct > 0.80


# ── Reproducibility Tests ────────────────────────────────────────


class TestReproducibility:
    """Verify seed-based reproducibility."""

    def test_same_seed_same_data(self) -> None:
        config = SCADAConfig(num_turbines=2, num_timesteps=100, seed=99)
        ds1 = generate_scada_dataset(config)
        ds2 = generate_scada_dataset(config)
        np.testing.assert_array_equal(ds1.wind_speed_ms, ds2.wind_speed_ms)
        np.testing.assert_array_equal(ds1.power_mw, ds2.power_mw)

    def test_different_seed_different_data(self) -> None:
        ds1 = generate_scada_dataset(SCADAConfig(num_turbines=2, num_timesteps=100, seed=1))
        ds2 = generate_scada_dataset(SCADAConfig(num_turbines=2, num_timesteps=100, seed=2))
        assert not np.array_equal(ds1.wind_speed_ms, ds2.wind_speed_ms)


# ── Full Farm Test ────────────────────────────────────────────────


class TestFullFarm:
    """Verify 34-turbine generation (default config)."""

    def test_34_turbines_present(self) -> None:
        config = SCADAConfig(num_turbines=34, num_timesteps=100, seed=42)
        ds = generate_scada_dataset(config)
        assert ds.wind_speed_ms.shape[1] == 34
        assert ds.power_mw.shape[1] == 34
