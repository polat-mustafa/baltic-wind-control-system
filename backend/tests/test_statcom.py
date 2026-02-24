"""
Unit tests for STATCOM sizing and reactive power compensation (P2A).

Tests validate cable reactive power calculation (Rule 7: Q always positive),
Ferranti voltage rise, STATCOM sizing margins, and compensation adequacy.

Test Strategy
-------------
- Cable Q: ≈ 130 MVAR for 220 kV, 45 km (analytical formula)
- Ferranti rise: visible without compensation (> 1.0 pu at no-load)
- STATCOM sizing: ≥ 80 MVAR with margins
- Compensation: voltage compliant with STATCOM + reactor enabled
- Without compensation: voltage violation (validates necessity)
"""

import pytest

from app.services.p2.statcom_sizing import (
    calculate_cable_reactive_power,
    size_statcom,
    validate_compensation,
)

# ── Cable Reactive Power Tests (Rule 7) ──────────────────────────


class TestCableReactivePower:
    """Tests for cable capacitive reactive power calculation."""

    def test_cable_q_positive(self):
        """Rule 7: Cable Q must always be positive (capacitive generation)."""
        q = calculate_cable_reactive_power()
        assert q > 0, f"Cable Q = {q} MVAR (must be positive)"

    def test_cable_q_range(self):
        """Export cable Q should be 100–160 MVAR for 220 kV, 45 km.

        Q = ω × C × V² × L = 314.16 × 190e-9 × (220e3)² × 45 ≈ 130 MVAR
        """
        q = calculate_cable_reactive_power()
        assert 100 < q < 160, f"Cable Q = {q:.1f} MVAR"

    def test_cable_q_proportional_to_length(self):
        """Cable Q must scale linearly with length."""
        q_45 = calculate_cable_reactive_power(length_km=45.0)
        q_90 = calculate_cable_reactive_power(length_km=90.0)
        assert q_90 == pytest.approx(2 * q_45, rel=0.01)

    def test_cable_q_proportional_to_voltage_squared(self):
        """Cable Q must scale with V²."""
        q_220 = calculate_cable_reactive_power(voltage_kv=220.0)
        q_110 = calculate_cable_reactive_power(voltage_kv=110.0)
        # Q(220) / Q(110) = (220/110)² = 4
        assert q_220 == pytest.approx(4 * q_110, rel=0.01)

    def test_cable_q_zero_length(self):
        """Zero-length cable must produce zero Q."""
        q = calculate_cable_reactive_power(length_km=0.0)
        assert q == pytest.approx(0.0, abs=0.01)


# ── STATCOM Sizing Tests ─────────────────────────────────────────


class TestSTATCOMSizing:
    """Tests for STATCOM rating calculation with margins."""

    def test_statcom_rating_positive(self):
        """STATCOM rating must be positive."""
        rating = size_statcom()
        assert rating > 0

    def test_statcom_rating_with_margins(self):
        """Rating with margins should exceed net Q after reactor."""
        cable_q = calculate_cable_reactive_power()
        reactor_q = 50.0
        net_q = cable_q - reactor_q
        rating = size_statcom(cable_q_mvar=cable_q, reactor_q_mvar=reactor_q)
        assert rating >= net_q, f"Rating ({rating}) < net Q ({net_q})"

    def test_statcom_rating_rounded(self):
        """STATCOM rating must be rounded to nearest 10 MVAR."""
        rating = size_statcom()
        assert rating % 10 == 0

    def test_statcom_no_reactor_larger(self):
        """Without reactor (N-1), STATCOM rating should be larger."""
        rating_with = size_statcom(n1_margin=1.0)
        rating_without = size_statcom(n1_margin=0.0)
        assert rating_without > rating_with


# ── Compensation Validation Tests ─────────────────────────────────


class TestCompensationValidation:
    """Tests for load flow validation with/without compensation."""

    def test_ferranti_rise_positive(self):
        """Ferranti voltage rise must be positive (V > 1.0 pu at no-load)."""
        result = validate_compensation()
        assert result.ferranti_rise_pu > 0, (
            f"Ferranti rise = {result.ferranti_rise_pu} pu (expected positive)"
        )

    def test_without_compensation_voltage_high(self):
        """Without compensation, no-load voltage must exceed 1.0 pu."""
        result = validate_compensation()
        assert result.without_compensation_v_max_pu > 1.0, (
            f"Uncompensated V_max = {result.without_compensation_v_max_pu} pu"
        )

    def test_compensation_adequate(self):
        """With reactor + STATCOM, voltage must be compliant."""
        result = validate_compensation()
        assert result.compensation_adequate, "Compensation inadequate — voltage non-compliant"

    def test_cable_q_in_result(self):
        """Result must include cable Q value."""
        result = validate_compensation()
        assert result.cable_q_mvar > 0

    def test_reactor_q_in_result(self):
        """Result must include reactor Q value (50 MVAR)."""
        result = validate_compensation()
        assert result.reactor_q_mvar == pytest.approx(50.0)

    def test_statcom_range(self):
        """STATCOM Q range must be ±120 MVAR."""
        result = validate_compensation()
        assert result.statcom_q_range_min_mvar == pytest.approx(-120.0)
        assert result.statcom_q_range_max_mvar == pytest.approx(120.0)
