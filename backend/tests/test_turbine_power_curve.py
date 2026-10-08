"""Tests for the P4 IEC 61400-12-1 power curve — SB-510 turbine = IEA 15 MW (official table).

Validates the specification, the power curve shape, the air-density normalisation
and the boundary conditions (Rule 1).
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.services.p1.turbine_models import get_turbine
from app.services.p4.turbine_power_curve import (
    PowerCurveResult,
    build_power_curve,
    compute_air_density_kg_m3,
    compute_swept_area_m2,
    get_turbine_spec,
    interpolate_power_mw,
)

RATED_MS = 10.6594  # IEA 15 MW: first table speed at 15 MW

# ── TurbineSpec Tests ─────────────────────────────────────────────


class TestTurbineSpec:
    """The SB-510 turbine ("V236 class") is the IEA 15 MW reference turbine."""

    def test_spec_comes_from_the_official_table(self) -> None:
        spec = get_turbine_spec()
        assert spec.model_id == "IEA-15-240-RWT" and "V236 class" in spec.name
        assert (spec.rated_power_mw, spec.rotor_diameter_m, spec.hub_height_m) == (
            15.0,
            241.35,
            150.0,
        )
        assert (spec.cut_in_speed_ms, spec.rated_speed_ms, spec.cut_out_speed_ms) == (
            3.0,
            RATED_MS,
            25.0,
        )

    def test_direct_drive(self) -> None:
        spec = get_turbine_spec()
        assert spec.drivetrain == "Low speed, Direct drive" and spec.gearbox_ratio == 1.0
        assert (spec.min_rotor_rpm, spec.max_rotor_rpm) == (5.0, 7.56)
        assert spec.nacelle_mass_kg == pytest.approx(673_000, rel=1e-3)

    def test_cp_and_ct_from_the_table(self) -> None:
        """Electrical Cp_max 0.442 (aerodynamic 0.462 × 95.7 %), Ct at rated 0.77."""
        spec = get_turbine_spec()
        assert spec.cp_max == pytest.approx(0.442, abs=0.001)
        assert spec.ct_rated == pytest.approx(0.772, abs=0.002)
        assert spec.cp_max < 16 / 27

    def test_frozen_dataclass(self) -> None:
        spec = get_turbine_spec()
        with pytest.raises(AttributeError):
            spec.rated_power_mw = 20.0  # type: ignore[misc]


# ── Swept Area Tests ──────────────────────────────────────────────


class TestSweptArea:
    """Verify swept area calculation: A = π × (D/2)²."""

    def test_iea15_swept_area(self) -> None:
        area = compute_swept_area_m2(241.35)
        assert area == pytest.approx(math.pi * 120.675**2)  # 45,750 m²

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

    def test_equals_the_official_table_at_reference_density(self, curve: PowerCurveResult) -> None:
        t = get_turbine()
        inside = (curve.wind_speeds_ms >= 3.0) & (curve.wind_speeds_ms <= 25.0)
        v = curve.wind_speeds_ms[inside]
        assert np.allclose(curve.power_mw[inside], t.power_curve_kw(v) / 1e3)

    def test_zero_power_below_cut_in(self, curve: PowerCurveResult) -> None:
        below = curve.wind_speeds_ms < 3.0
        assert np.all(curve.power_mw[below] == 0.0)

    def test_zero_power_above_cut_out(self, curve: PowerCurveResult) -> None:
        above = curve.wind_speeds_ms > 25.0
        assert np.all(curve.power_mw[above] == 0.0)

    def test_power_monotonic_in_region2(self, curve: PowerCurveResult) -> None:
        region2 = (curve.wind_speeds_ms >= 3.0) & (curve.wind_speeds_ms <= RATED_MS)
        assert np.all(np.diff(curve.power_mw[region2]) >= 0.0)

    def test_rated_plateau_in_region3(self, curve: PowerCurveResult) -> None:
        """15 MW from 10.66 m/s to the 25 m/s cut-out (pitch-regulated)."""
        region3 = (curve.wind_speeds_ms >= 11.0) & (curve.wind_speeds_ms <= 25.0)
        assert np.all(curve.power_mw[region3] == 15.0)

    def test_power_never_exceeds_rated(self, curve: PowerCurveResult) -> None:
        assert np.all(curve.power_mw <= 15.0)

    def test_power_never_negative(self, curve: PowerCurveResult) -> None:
        assert np.all(curve.power_mw >= 0.0)


class TestAirDensityNormalisation:
    """IEC 61400-12-1 §9.1.5: P_ρ(v) = P_ref(v·(ρ/ρ₀)^(1/3)) for a pitch-regulated rotor."""

    def test_cold_dense_air_gives_more_power_in_region_2(self) -> None:
        ref = build_power_curve()
        cold = build_power_curve(air_density_kg_m3=1.30)
        i = int(np.argmin(np.abs(ref.wind_speeds_ms - 8.0)))
        expected = get_turbine().power_curve_kw(8.0 * (1.30 / 1.225) ** (1 / 3)) / 1e3
        assert cold.power_mw[i] == pytest.approx(expected)
        assert cold.power_mw[i] > ref.power_mw[i]

    def test_cut_out_stays_on_the_measured_wind(self) -> None:
        light = build_power_curve(air_density_kg_m3=1.10)
        assert light.power_mw[light.wind_speeds_ms == 25.0][0] == 15.0
        assert np.all(light.power_mw[light.wind_speeds_ms > 25.0] == 0.0)


# ── Thrust Coefficient Tests ─────────────────────────────────────


class TestThrustCoefficient:
    """Verify Ct profile."""

    @pytest.fixture()
    def curve(self) -> PowerCurveResult:
        return build_power_curve()

    def test_ct_falls_above_rated(self, curve: PowerCurveResult) -> None:
        """Ct ≈ 0.78 in region 2, 0.77 at rated, pitched down to ≈ 0.04 at cut-out."""
        at = lambda v: curve.ct[int(np.argmin(np.abs(curve.wind_speeds_ms - v)))]  # noqa: E731
        assert at(7.0) == pytest.approx(0.78, abs=0.01)
        assert at(25.0) == pytest.approx(0.044, abs=0.005)

    def test_ct_zero_below_cut_in(self, curve: PowerCurveResult) -> None:
        below = curve.wind_speeds_ms < 3.0
        assert np.all(curve.ct[below] == 0.0)

    def test_ct_zero_above_cut_out(self, curve: PowerCurveResult) -> None:
        above = curve.wind_speeds_ms > 25.0
        assert np.all(curve.ct[above] == 0.0)


# ── Interpolation Tests ──────────────────────────────────────────


class TestInterpolation:
    """Verify power interpolation at arbitrary wind speeds."""

    def test_interpolate_at_zero(self) -> None:
        assert interpolate_power_mw(0.0) == 0.0

    def test_interpolate_at_rated(self) -> None:
        assert interpolate_power_mw(11.0) == pytest.approx(15.0)

    def test_interpolate_above_cutout(self) -> None:
        assert interpolate_power_mw(26.0) == 0.0

    def test_interpolate_array(self) -> None:
        winds = np.array([0.0, 5.0, 11.0, 20.0, 35.0])
        powers = interpolate_power_mw(winds)
        assert isinstance(powers, np.ndarray)
        assert len(powers) == 5
        assert powers[0] == 0.0  # Below cut-in
        assert powers[-1] == 0.0  # Above cut-out
        assert powers[2] == pytest.approx(15.0)
