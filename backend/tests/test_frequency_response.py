"""
Unit tests for frequency response simulation (P2B — frequency_response.py).

Tests validate NC RfG Type D frequency modes: LFSM-O, LFSM-U, FSM droop,
and RoCoF withstand.

Test Strategy
-------------
- LFSM-O: power reduces when f > 50.2 Hz
- LFSM-U: power increases when f < 49.8 Hz (with headroom)
- FSM: droop response matches ΔP = -(P_rated/R) × (Δf/f_nom) within 20%
- RoCoF: system stays stable at 2 Hz/s for 500 ms
- Droop formula: unit tests for calculate_expected_droop_response
"""

import pytest

from app.schemas.grid import FrequencyMode
from app.services.p2.frequency_response import (
    calculate_expected_droop_response,
    run_frequency_response,
    run_rocof_withstand,
)

# ── Droop Formula Tests ─────────────────────────────────────────


class TestDroopFormula:
    """Tests for the droop formula calculation."""

    def test_overfrequency_reduces_power(self):
        """Positive Δf (overfrequency) must produce negative ΔP (reduce)."""
        dp = calculate_expected_droop_response(
            freq_dev_hz=0.5,
            droop_pct=5.0,
            rated_mw=510.0,
        )
        assert dp < 0, f"ΔP = {dp:.1f} MW should be negative for overfrequency"

    def test_underfrequency_increases_power(self):
        """Negative Δf (underfrequency) must produce positive ΔP (increase)."""
        dp = calculate_expected_droop_response(
            freq_dev_hz=-0.5,
            droop_pct=5.0,
            rated_mw=510.0,
        )
        assert dp > 0, f"ΔP = {dp:.1f} MW should be positive for underfrequency"

    def test_droop_formula_magnitude(self):
        """ΔP magnitude for 0.5 Hz step at 5% droop on 510 MW.

        ΔP = -(510 / 0.05) × (0.5 / 50) = -102 MW
        """
        dp = calculate_expected_droop_response(
            freq_dev_hz=0.5,
            droop_pct=5.0,
            rated_mw=510.0,
        )
        assert dp == pytest.approx(-102.0, rel=0.01)

    def test_zero_frequency_deviation(self):
        """Zero Δf must produce zero ΔP."""
        dp = calculate_expected_droop_response(
            freq_dev_hz=0.0,
            droop_pct=5.0,
            rated_mw=510.0,
        )
        assert dp == pytest.approx(0.0)

    def test_higher_droop_smaller_response(self):
        """Higher droop % (less sensitive) → smaller ΔP magnitude."""
        dp_5pct = calculate_expected_droop_response(0.5, 5.0, 510.0)
        dp_10pct = calculate_expected_droop_response(0.5, 10.0, 510.0)
        assert abs(dp_10pct) < abs(dp_5pct)


# ── LFSM-O Tests ────────────────────────────────────────────────


class TestLFSMO:
    """Tests for Limited Frequency Sensitive Mode — Overfrequency."""

    def test_lfsm_o_reduces_power(self):
        """LFSM-O must reduce active power when f > 50.2 Hz."""
        result = run_frequency_response(
            mode=FrequencyMode.LFSM_O,
            freq_step_hz=0.5,
            droop_pct=5.0,
        )
        assert result.power_change_mw < 0, (
            f"LFSM-O ΔP = {result.power_change_mw:.1f} MW — should be negative"
        )

    def test_lfsm_o_compliant(self):
        """LFSM-O response must be compliant per NC RfG."""
        result = run_frequency_response(
            mode=FrequencyMode.LFSM_O,
            freq_step_hz=0.5,
        )
        assert result.compliant, "LFSM-O not compliant"

    def test_lfsm_o_stable(self):
        """System must remain stable during LFSM-O event."""
        result = run_frequency_response(mode=FrequencyMode.LFSM_O)
        assert result.stable, "System unstable during LFSM-O"


# ── LFSM-U Tests ────────────────────────────────────────────────


class TestLFSMU:
    """Tests for Limited Frequency Sensitive Mode — Underfrequency."""

    def test_lfsm_u_increases_power(self):
        """LFSM-U must increase active power when f < 49.8 Hz."""
        result = run_frequency_response(
            mode=FrequencyMode.LFSM_U,
            freq_step_hz=0.5,
            generation_fraction=0.8,  # headroom for increase
        )
        assert result.power_change_mw > 0, (
            f"LFSM-U ΔP = {result.power_change_mw:.1f} MW — should be positive"
        )

    def test_lfsm_u_compliant(self):
        """LFSM-U response must be compliant per NC RfG."""
        result = run_frequency_response(
            mode=FrequencyMode.LFSM_U,
            freq_step_hz=0.5,
            generation_fraction=0.8,
        )
        assert result.compliant, "LFSM-U not compliant"


# ── FSM Droop Tests ──────────────────────────────────────────────


class TestFSM:
    """Tests for Frequency Sensitive Mode (droop-based)."""

    def test_fsm_matches_droop(self):
        """FSM response must match droop formula within 20% tolerance."""
        result = run_frequency_response(
            mode=FrequencyMode.FSM,
            freq_step_hz=0.3,
            droop_pct=5.0,
        )
        assert result.compliant, (
            f"FSM: measured ΔP={result.power_change_mw:.1f} MW vs "
            f"expected {result.expected_power_change_mw:.1f} MW"
        )

    def test_fsm_stable(self):
        """System must remain stable during FSM droop response."""
        result = run_frequency_response(mode=FrequencyMode.FSM, freq_step_hz=0.3)
        assert result.stable


# ── RoCoF Tests ──────────────────────────────────────────────────


class TestRoCoF:
    """Tests for Rate of Change of Frequency withstand."""

    def test_rocof_withstand_stable(self):
        """System must remain stable at 2 Hz/s for 500 ms."""
        result = run_rocof_withstand(rocof_hz_per_s=2.0, duration_s=0.5)
        assert result.stable, "System unstable during 2 Hz/s RoCoF event"

    def test_rocof_compliant(self):
        """RoCoF withstand must be compliant per NC RfG Article 13."""
        result = run_frequency_response(mode=FrequencyMode.ROCOF)
        assert result.compliant, "RoCoF withstand not compliant"
