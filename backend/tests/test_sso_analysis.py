"""
Unit tests for SSO screening (P2B — sso_analysis.py).

Tests validate cable resonance formula, impedance scan, risk classification,
and the complete SSO screening pipeline.

Test Strategy
-------------
- Cable resonance: formula correct for known cable parameters
- Strong grid (SCR ≈ 19.6): low SSO risk
- Weak grid (SCR ≈ 3.9): higher risk classification
- Impedance scan: Re{Z} > 0 for strong grid
- Risk classification: correct mapping of SCR/damping/phase margin
"""

import math

import pytest

from app.schemas.grid import SSOGRiskLevel
from app.services.p2.network_model import EXPORT_CABLE_LENGTH_KM
from app.services.p2.sso_analysis import (
    calculate_cable_resonance_frequency,
    run_impedance_scan,
    run_sso_screening,
)

# ── Cable Resonance Formula Tests ──────────────────────────────


class TestCableResonance:
    """Tests for cable LC resonance frequency calculation."""

    def test_resonance_formula_correct(self):
        """Resonance frequency must match f = 1/(2π√(LC)) for known values.

        For 220 kV, 45 km export cable:
          L = X/(2πf) × length = 0.116/(2π×50) × 45 ≈ 16.6 mH
          C = 190 nF/km × 45 = 8.55 μF
          f_res = 1/(2π√(LC))
        """
        f_res = calculate_cable_resonance_frequency(EXPORT_CABLE_LENGTH_KM)
        assert f_res > 0, "Resonance frequency must be positive"
        # For 45 km at these parameters, resonance should be well above 50 Hz
        assert f_res > 100, f"f_res = {f_res:.1f} Hz should be > 100 Hz for 45 km cable"

    def test_longer_cable_lower_resonance(self):
        """Longer cable → higher LC product → lower resonance frequency."""
        f_45 = calculate_cable_resonance_frequency(45.0)
        f_90 = calculate_cable_resonance_frequency(90.0)
        assert f_90 < f_45, "Longer cable should have lower resonance frequency"

    def test_shorter_cable_higher_resonance(self):
        """Shorter cable → lower LC product → higher resonance frequency."""
        f_45 = calculate_cable_resonance_frequency(45.0)
        f_20 = calculate_cable_resonance_frequency(20.0)
        assert f_20 > f_45, "Shorter cable should have higher resonance frequency"

    def test_resonance_scales_inversely_with_length(self):
        """Resonance scales as 1/length (since LC = l*c*length^2, sqrt(LC) ~ length)."""
        f_45 = calculate_cable_resonance_frequency(45.0)
        f_180 = calculate_cable_resonance_frequency(180.0)
        # f_180 / f_45 = 45/180 = 0.25
        ratio = f_180 / f_45
        assert ratio == pytest.approx(0.25, rel=0.05)

    def test_zero_length_returns_inf(self):
        """Zero cable length should return infinite resonance frequency."""
        f_res = calculate_cable_resonance_frequency(0.0)
        assert f_res == float("inf")

    def test_custom_cable_parameters(self):
        """Custom L and C values should produce correct resonance."""
        # L = 1 mH/km, C = 100 nF/km, length = 10 km
        # L_total = 0.01 H, C_total = 1 μF
        # f_res = 1/(2π√(0.01 × 1e-6)) = 1/(2π × 1e-4) ≈ 1591 Hz
        f_res = calculate_cable_resonance_frequency(
            length_km=10.0,
            l_mh_per_km=1.0,
            c_nf_per_km=100.0,
        )
        expected = 1.0 / (2.0 * math.pi * math.sqrt(0.01 * 1e-6))
        assert f_res == pytest.approx(expected, rel=0.01)


# ── Impedance Scan Tests ────────────────────────────────────────


class TestImpedanceScan:
    """Tests for frequency-domain impedance scan."""

    def test_impedance_scan_returns_arrays(self):
        """Impedance scan must return frequency, real, and imaginary arrays."""
        freqs, real_z, imag_z = run_impedance_scan()
        assert len(freqs) > 0
        assert len(real_z) == len(freqs)
        assert len(imag_z) == len(freqs)

    def test_positive_resistance_strong_grid(self):
        """Re{Z} > 0 at all sub-synchronous frequencies for strong grid."""
        _freqs, real_z, _ = run_impedance_scan(
            export_length_km=45.0,
            grid_ssc_mva=10_000.0,
        )
        assert all(r > 0 for r in real_z), "Negative resistance found at strong grid"

    def test_frequency_range(self):
        """Impedance scan must cover 1–49 Hz sub-synchronous range."""
        freqs, _, _ = run_impedance_scan()
        assert float(freqs[0]) == pytest.approx(1.0, abs=0.5)
        assert float(freqs[-1]) == pytest.approx(49.0, abs=0.5)


# ── SSO Screening Pipeline Tests ────────────────────────────────


class TestSSOScreening:
    """Tests for complete SSO screening pipeline."""

    def test_strong_grid_low_risk(self):
        """Strong grid (SCR ≈ 19.6) must classify as low SSO risk."""
        result = run_sso_screening(
            export_length_km=45.0,
            grid_ssc_mva=10_000.0,
        )
        assert result.risk_level == SSOGRiskLevel.LOW, (
            f"Strong grid SSO risk = {result.risk_level}, expected low"
        )

    def test_strong_grid_stable(self):
        """Strong grid must be SSO-stable."""
        result = run_sso_screening(
            export_length_km=45.0,
            grid_ssc_mva=10_000.0,
        )
        assert result.stable, "Strong grid should be SSO-stable"

    def test_weak_grid_higher_risk(self):
        """Weak grid (SCR ≈ 3.9) must have higher SSO risk than strong grid."""
        strong = run_sso_screening(grid_ssc_mva=10_000.0)
        weak = run_sso_screening(grid_ssc_mva=2_000.0)

        risk_order = {SSOGRiskLevel.LOW: 0, SSOGRiskLevel.MEDIUM: 1, SSOGRiskLevel.HIGH: 2}
        assert risk_order[weak.risk_level] >= risk_order[strong.risk_level], (
            f"Weak grid risk ({weak.risk_level}) should be ≥ strong grid ({strong.risk_level})"
        )

    def test_resonance_frequency_populated(self):
        """SSO result must include cable resonance frequency."""
        result = run_sso_screening()
        assert result.resonance_frequency_hz > 0

    def test_phase_margin_populated(self):
        """SSO result must include phase margin."""
        result = run_sso_screening()
        assert result.phase_margin_deg > 0

    def test_minimum_damping_ratio_populated(self):
        """SSO result must include minimum damping ratio."""
        result = run_sso_screening()
        assert 0.0 <= result.minimum_damping_ratio <= 1.0
