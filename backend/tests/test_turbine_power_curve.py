"""Tests for IEC 61400-12-1 power curve model — V236-15.0 MW.

Validates physics calculations, power curve shape, and boundary conditions.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.services.p4.turbine_power_curve import (
    PowerCurveResult,
    build_power_curve,
    compute_air_density_kg_m3,
    compute_swept_area_m2,
    get_v236_spec,
    interpolate_power_mw,
)

# ── TurbineSpec Tests ─────────────────────────────────────────────


class TestTurbineSpec:
    """Verify V236-15.0 MW specification values."""

    def test_default_spec_name(self) -> None:
        spec = get_v236_spec()
        assert spec.name == "Vestas V236-15.0 MW"

    def test_rated_power_15mw(self) -> None:
        spec = get_v236_spec()
        assert spec.rated_power_mw == 15.0

    def test_rotor_diameter_236m(self) -> None:
        spec = get_v236_spec()
        assert spec.rotor_diameter_m == 236.0

    def test_cut_in_3ms(self) -> None:
        spec = get_v236_spec()
        assert spec.cut_in_speed_ms == 3.0

    def test_cut_out_31ms(self) -> None:
        spec = get_v236_spec()
        assert spec.cut_out_speed_ms == 31.0

    def test_frozen_dataclass(self) -> None:
        spec = get_v236_spec()
        with pytest.raises(AttributeError):
            spec.rated_power_mw = 20.0  # type: ignore[misc]


# ── Swept Area Tests ──────────────────────────────────────────────


class TestSweptArea:
    """Verify swept area calculation: A = π × (D/2)²."""

    def test_v236_swept_area(self) -> None:
        area = compute_swept_area_m2(236.0)
        expected = math.pi * 118.0**2  # 43,743.54 m²
        assert abs(area - expected) < 0.01

    def test_swept_area_positive(self) -> None:
        area = compute_swept_area_m2(100.0)
        assert area > 0

    def test_swept_area_scales_with_diameter_squared(self) -> None:
        a1 = compute_swept_area_m2(100.0)
        a2 = compute_swept_area_m2(200.0)
        assert abs(a2 / a1 - 4.0) < 0.001  # Doubling D → 4× area


# ── Air Density Tests ─────────────────────────────────────────────


class TestAirDensity:
    """Verify ideal gas law: ρ = P / (R × T)."""

    def test_standard_conditions(self) -> None:
        rho = compute_air_density_kg_m3()
        assert abs(rho - 1.225) < 0.001

    def test_cold_baltic_winter(self) -> None:
        """At -10°C (263.15 K), density should be higher than standard."""
        rho = compute_air_density_kg_m3(temperature_k=263.15)
        assert rho > 1.3  # Cold air is denser

    def test_warm_summer(self) -> None:
        """At 30°C (303.15 K), density should be lower than standard."""
        rho = compute_air_density_kg_m3(temperature_k=303.15)
        assert rho < 1.2

    def test_invalid_temperature_raises(self) -> None:
        with pytest.raises(ValueError, match="Temperature"):
            compute_air_density_kg_m3(temperature_k=0.0)

    def test_invalid_pressure_raises(self) -> None:
        with pytest.raises(ValueError, match="Pressure"):
            compute_air_density_kg_m3(pressure_pa=-100.0)


# ── Power Curve Shape Tests ───────────────────────────────────────


class TestPowerCurveShape:
    """Verify the 4-region power curve shape."""

    @pytest.fixture()
    def curve(self) -> PowerCurveResult:
        return build_power_curve()

    def test_zero_power_below_cut_in(self, curve: PowerCurveResult) -> None:
        below = curve.wind_speeds_ms < 3.0
        assert np.all(curve.power_mw[below] == 0.0)

    def test_zero_power_above_cut_out(self, curve: PowerCurveResult) -> None:
        above = curve.wind_speeds_ms > 31.0
        assert np.all(curve.power_mw[above] == 0.0)

    def test_rated_power_at_rated_speed(self, curve: PowerCurveResult) -> None:
        """Power should reach rated (15 MW) at rated wind speed."""
        rated_idx = np.argmin(np.abs(curve.wind_speeds_ms - 12.5))
        assert curve.power_mw[rated_idx] == pytest.approx(15.0, abs=0.5)

    def test_power_monotonic_in_region2(self, curve: PowerCurveResult) -> None:
        """Power should increase monotonically from cut-in to rated."""
        region2 = (curve.wind_speeds_ms >= 3.0) & (curve.wind_speeds_ms <= 12.5)
        power_r2 = curve.power_mw[region2]
        # Allow small tolerance for numerical noise
        diffs = np.diff(power_r2)
        assert np.all(diffs >= -0.01)

    def test_rated_plateau_in_region3(self, curve: PowerCurveResult) -> None:
        """Power should be at rated in Region 3 (12.5-31.0 m/s)."""
        region3 = (curve.wind_speeds_ms >= 13.0) & (curve.wind_speeds_ms <= 31.0)
        power_r3 = curve.power_mw[region3]
        assert np.all(power_r3 >= 14.5)  # Near rated
        assert np.all(power_r3 <= 15.0)

    def test_power_never_exceeds_rated(self, curve: PowerCurveResult) -> None:
        assert np.all(curve.power_mw <= 15.0)

    def test_power_never_negative(self, curve: PowerCurveResult) -> None:
        assert np.all(curve.power_mw >= 0.0)


# ── Thrust Coefficient Tests ─────────────────────────────────────


class TestThrustCoefficient:
    """Verify Ct profile."""

    @pytest.fixture()
    def curve(self) -> PowerCurveResult:
        return build_power_curve()

    def test_ct_at_rated_speed(self, curve: PowerCurveResult) -> None:
        rated_idx = np.argmin(np.abs(curve.wind_speeds_ms - 12.5))
        assert curve.ct[rated_idx] == pytest.approx(0.28, abs=0.05)

    def test_ct_zero_below_cut_in(self, curve: PowerCurveResult) -> None:
        below = curve.wind_speeds_ms < 3.0
        assert np.all(curve.ct[below] == 0.0)

    def test_ct_zero_above_cut_out(self, curve: PowerCurveResult) -> None:
        above = curve.wind_speeds_ms > 31.0
        assert np.all(curve.ct[above] == 0.0)


# ── Interpolation Tests ──────────────────────────────────────────


class TestInterpolation:
    """Verify power interpolation at arbitrary wind speeds."""

    def test_interpolate_at_zero(self) -> None:
        assert interpolate_power_mw(0.0) == 0.0

    def test_interpolate_at_rated(self) -> None:
        p = interpolate_power_mw(12.5)
        assert p == pytest.approx(15.0, abs=0.5)

    def test_interpolate_above_cutout(self) -> None:
        assert interpolate_power_mw(35.0) == 0.0

    def test_interpolate_array(self) -> None:
        winds = np.array([0.0, 5.0, 12.5, 20.0, 35.0])
        powers = interpolate_power_mw(winds)
        assert isinstance(powers, np.ndarray)
        assert len(powers) == 5
        assert powers[0] == 0.0  # Below cut-in
        assert powers[-1] == 0.0  # Above cut-out
