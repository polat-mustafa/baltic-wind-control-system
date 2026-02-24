"""
Unit tests for wind rose analysis.

Tests validate directional sector classification, frequency computation,
mean speed per sector, sector-wise Weibull fitting, energy rose (cubic law),
circular standard deviation, and full wind rose orchestration.

Test Strategy
-------------
- Sector classification: verify N/S/E/W mapping, boundary cases, 12 vs 16 sectors
- Frequencies: uniform wind sums to 1.0, single-direction dominance
- Mean speed: known values, empty sectors → NaN
- Weibull: valid A/k per sector, insufficient data → None
- Energy rose: sum to 1.0, cubic law (high-speed sector dominates)
- Circular std: constant direction → ~0, uniform → high std
- Full wind rose: WSW-dominant synthetic data, result structure validation
"""

import numpy as np
import pytest
from numpy.typing import NDArray

from app.services.p1.wind_analysis import (
    WindRoseResult,
    classify_direction_sector,
    compute_circular_std_deg,
    compute_energy_rose,
    compute_sector_frequencies,
    compute_sector_mean_speed_ms,
    compute_wind_rose,
    fit_sector_weibull,
)

# ── Sector Classification ─────────────────────────────────────────


class TestClassifyDirectionSector:
    """Tests for directional sector classification."""

    def test_north_maps_to_sector_0(self):
        """0° (North) should map to sector 0."""
        directions = np.array([0.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 0

    def test_east_maps_to_sector_3(self):
        """90° (East) should map to sector 3 in 12-sector rose."""
        directions = np.array([90.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 3

    def test_south_maps_to_sector_6(self):
        """180° (South) should map to sector 6 in 12-sector rose."""
        directions = np.array([180.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 6

    def test_west_maps_to_sector_9(self):
        """270° (West) should map to sector 9 in 12-sector rose."""
        directions = np.array([270.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 9

    def test_boundary_falls_correctly(self):
        """Direction at sector boundary should map to the correct sector.

        With 12 sectors (30° each), sector 0 spans 345°–15°.
        15° is the boundary — should map to sector 1.
        """
        directions = np.array([15.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 1

    def test_near_360_maps_to_sector_0(self):
        """359° should map to sector 0 (centred on North)."""
        directions = np.array([359.0])
        indices = classify_direction_sector(directions, num_sectors=12)
        assert indices[0] == 0

    def test_16_sectors(self):
        """16-sector rose: 90° should map to sector 4 (each sector = 22.5°)."""
        directions = np.array([90.0])
        indices = classify_direction_sector(directions, num_sectors=16)
        assert indices[0] == 4

    def test_all_indices_in_valid_range(self):
        """All sector indices should be in [0, num_sectors-1]."""
        rng = np.random.default_rng(42)
        directions = rng.uniform(0, 360, size=10000)
        indices = classify_direction_sector(directions, num_sectors=12)
        assert np.all(indices >= 0)
        assert np.all(indices < 12)


# ── Sector Frequencies ─────────────────────────────────────────────


class TestSectorFrequencies:
    """Tests for sector frequency computation."""

    def test_frequencies_sum_to_one(self):
        """Total frequency across all sectors should equal 1.0."""
        rng = np.random.default_rng(42)
        directions = rng.uniform(0, 360, size=5000)
        indices = classify_direction_sector(directions, num_sectors=12)
        freqs = compute_sector_frequencies(indices, num_sectors=12)
        assert freqs.sum() == pytest.approx(1.0, abs=1e-10)

    def test_uniform_wind_roughly_equal(self):
        """Uniformly distributed directions should give ~equal frequencies."""
        rng = np.random.default_rng(42)
        directions = rng.uniform(0, 360, size=120000)
        indices = classify_direction_sector(directions, num_sectors=12)
        freqs = compute_sector_frequencies(indices, num_sectors=12)
        expected = 1.0 / 12
        for freq in freqs:
            assert freq == pytest.approx(expected, abs=0.01)

    def test_single_direction_dominates(self):
        """All wind from one direction → one sector has frequency 1.0."""
        directions = np.full(1000, 90.0)  # All East
        indices = classify_direction_sector(directions, num_sectors=12)
        freqs = compute_sector_frequencies(indices, num_sectors=12)
        assert freqs[3] == pytest.approx(1.0)
        assert np.sum(freqs == 0.0) == 11


# ── Sector Mean Speed ──────────────────────────────────────────────


class TestSectorMeanSpeed:
    """Tests for per-sector mean wind speed computation."""

    def test_known_values(self):
        """Mean speed should match hand-calculated values."""
        speeds = np.array([5.0, 10.0, 15.0])
        # All in sector 0 (North)
        indices = np.array([0, 0, 0])
        means = compute_sector_mean_speed_ms(speeds, indices, num_sectors=3)
        assert means[0] == pytest.approx(10.0)

    def test_empty_sector_is_nan(self):
        """Sectors with no observations should have NaN mean speed."""
        speeds = np.array([5.0, 10.0])
        indices = np.array([0, 0])
        means = compute_sector_mean_speed_ms(speeds, indices, num_sectors=3)
        assert np.isnan(means[1])
        assert np.isnan(means[2])

    def test_different_sectors_different_means(self):
        """Each sector should compute its own independent mean."""
        speeds = np.array([5.0, 6.0, 15.0, 16.0])
        indices = np.array([0, 0, 1, 1])
        means = compute_sector_mean_speed_ms(speeds, indices, num_sectors=2)
        assert means[0] == pytest.approx(5.5)
        assert means[1] == pytest.approx(15.5)


# ── Sector Weibull Fit ─────────────────────────────────────────────


class TestFitSectorWeibull:
    """Tests for sector-wise Weibull fitting."""

    def test_valid_fit_per_sector(self):
        """Sectors with enough data should produce valid Weibull parameters."""
        rng = np.random.default_rng(42)
        # Generate enough data in two sectors
        speeds = np.concatenate(
            [
                rng.weibull(2.0, 500) * 10.0,  # Sector 0
                rng.weibull(2.5, 500) * 8.0,  # Sector 1
            ]
        )
        indices = np.concatenate(
            [
                np.zeros(500, dtype=np.intp),
                np.ones(500, dtype=np.intp),
            ]
        )
        results = fit_sector_weibull(speeds, indices, num_sectors=3)
        assert results[0] is not None
        assert results[0].scale_a_ms > 0
        assert results[0].shape_k > 0
        assert results[1] is not None
        assert results[1].scale_a_ms > 0

    def test_insufficient_data_returns_none(self):
        """Sectors with < 100 valid points should return None."""
        speeds = np.array([5.0, 6.0, 7.0])
        indices = np.array([0, 0, 0])
        results = fit_sector_weibull(speeds, indices, num_sectors=2)
        assert results[0] is None
        assert results[1] is None


# ── Energy Rose ────────────────────────────────────────────────────


class TestEnergyRose:
    """Tests for energy fraction computation (cubic law)."""

    def test_energy_fractions_sum_to_one(self):
        """Energy fractions should sum to 1.0."""
        freqs = np.array([0.3, 0.5, 0.2])
        speeds = np.array([8.0, 10.0, 6.0])
        energy = compute_energy_rose(freqs, speeds)
        assert energy.sum() == pytest.approx(1.0, abs=1e-10)

    def test_high_speed_sector_dominates(self):
        """Sector with much higher speed should dominate energy (cubic law)."""
        freqs = np.array([0.5, 0.5])  # Equal frequency
        speeds = np.array([5.0, 10.0])  # 10 m/s has 8× the energy of 5 m/s
        energy = compute_energy_rose(freqs, speeds)
        # Energy ratio: 10³/5³ = 8, so sector 1 gets 8/(1+8) ≈ 0.889
        assert energy[1] > energy[0]
        assert energy[1] == pytest.approx(8.0 / 9.0, abs=0.001)

    def test_nan_speeds_treated_as_zero(self):
        """Sectors with NaN speeds should contribute zero energy."""
        freqs = np.array([0.5, 0.3, 0.2])
        speeds = np.array([10.0, np.nan, 8.0])
        energy = compute_energy_rose(freqs, speeds)
        assert energy[1] == 0.0
        assert energy.sum() == pytest.approx(1.0, abs=1e-10)


# ── Circular Standard Deviation ────────────────────────────────────


class TestCircularStd:
    """Tests for circular standard deviation (Mardia's formula)."""

    def test_constant_direction_near_zero(self):
        """All wind from same direction → circular std ≈ 0."""
        directions = np.full(1000, 180.0)
        std = compute_circular_std_deg(directions)
        assert std == pytest.approx(0.0, abs=1.0)

    def test_uniform_gives_high_std(self):
        """Uniformly distributed directions → high circular std."""
        directions = np.linspace(0, 360, 10000, endpoint=False)
        std = compute_circular_std_deg(directions)
        # Uniform distribution: R̄ → 0, so std → large (theoretical max ~81°)
        assert std > 70.0

    def test_opposite_directions(self):
        """Equal split between 0° and 180° → high std."""
        directions = np.array([0.0] * 500 + [180.0] * 500)
        std = compute_circular_std_deg(directions)
        assert std > 50.0

    def test_empty_returns_zero(self):
        """Empty array should return 0."""
        std = compute_circular_std_deg(np.array([]))
        assert std == 0.0


# ── Full Wind Rose Computation ─────────────────────────────────────


class TestComputeWindRose:
    """Integration tests for the complete wind rose computation."""

    def _generate_wsw_dominant_data(
        self, n_samples: int = 50000, seed: int = 42
    ) -> tuple[NDArray[np.floating], NDArray[np.floating]]:
        """Generate synthetic wind data with WSW dominance (~240°).

        Mimics Baltic Sea conditions: dominant WSW, Weibull-like speeds.
        """
        rng = np.random.default_rng(seed)

        # Direction: von Mises distribution centred on 240° (WSW)
        mean_dir_rad = np.deg2rad(240.0)
        kappa = 2.0  # Concentration parameter (moderate directional spread)
        directions_rad = rng.vonmises(mean_dir_rad - np.pi, kappa, n_samples) + np.pi
        directions_deg = np.degrees(directions_rad) % 360.0

        # Speed: Weibull(A=10.5, k=2.2) — typical Baltic offshore
        speeds = rng.weibull(2.2, n_samples) * 10.5

        return speeds.astype(np.float64), directions_deg.astype(np.float64)

    def test_result_type(self):
        """compute_wind_rose should return WindRoseResult."""
        speeds, directions = self._generate_wsw_dominant_data(n_samples=5000)
        result = compute_wind_rose(speeds, directions)
        assert isinstance(result, WindRoseResult)

    def test_dominant_direction_is_wsw(self):
        """Dominant direction should be near WSW (~240°)."""
        speeds, directions = self._generate_wsw_dominant_data()
        result = compute_wind_rose(speeds, directions)
        # Dominant should be within ±30° of 240°
        assert 210.0 <= result.dominant_direction_deg <= 270.0

    def test_frequencies_sum_to_one(self):
        """Total frequency should sum to 1.0."""
        speeds, directions = self._generate_wsw_dominant_data()
        result = compute_wind_rose(speeds, directions)
        assert result.frequencies.sum() == pytest.approx(1.0, abs=1e-10)

    def test_energy_fractions_sum_to_one(self):
        """Total energy should sum to 1.0."""
        speeds, directions = self._generate_wsw_dominant_data()
        result = compute_wind_rose(speeds, directions)
        assert result.energy_fractions.sum() == pytest.approx(1.0, abs=1e-10)

    def test_num_sectors_in_result(self):
        """Result should contain correct number of sectors."""
        speeds, directions = self._generate_wsw_dominant_data(n_samples=5000)
        result = compute_wind_rose(speeds, directions, num_sectors=16)
        assert result.num_sectors == 16
        assert len(result.sector_centres_deg) == 16
        assert len(result.frequencies) == 16

    def test_circular_std_reasonable(self):
        """Circular std should be moderate for directionally biased data."""
        speeds, directions = self._generate_wsw_dominant_data()
        result = compute_wind_rose(speeds, directions)
        # Not constant (>10°) and not uniform (< 80°)
        assert 20.0 < result.circular_std_deg < 80.0

    def test_mismatched_lengths_raises(self):
        """Different-length speed and direction arrays should raise ValueError."""
        speeds = np.array([5.0, 10.0])
        directions = np.array([90.0])
        with pytest.raises(ValueError, match="equal length"):
            compute_wind_rose(speeds, directions)

    def test_empty_arrays_raises(self):
        """Empty arrays should raise ValueError."""
        with pytest.raises(ValueError, match="empty"):
            compute_wind_rose(np.array([]), np.array([]))
