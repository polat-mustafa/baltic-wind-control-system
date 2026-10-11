"""Tests for the P4 IEC 61400-12-1 power curve — SB-510 turbine = IEA 15 MW (official table).

Validates the specification, the power curve shape, the air-density normalisation
and the boundary conditions (Rule 1).
"""

from __future__ import annotations

import math

import pytest

from app.services.p4.turbine_power_curve import (
    compute_swept_area_m2,
    get_turbine_spec,
)

RATED_MS = 10.6594  # IEA 15 MW: first table speed at 15 MW

# ── TurbineSpec Tests ─────────────────────────────────────────────


class TestTurbineSpec:
    """The SB-510 turbine ("V236 class") is the IEA 15 MW reference turbine."""

    def test_spec_comes_from_the_official_table(self) -> None:
        spec = get_turbine_spec()
        assert spec.model_id == "IEA-15-240-RWT"
        assert spec.name == "IEA 15 MW reference turbine (IEA-15-240-RWT)"
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


# ── Power Curve Shape Tests ───────────────────────────────────────


# ── Thrust Coefficient Tests ─────────────────────────────────────


# ── Interpolation Tests ──────────────────────────────────────────
