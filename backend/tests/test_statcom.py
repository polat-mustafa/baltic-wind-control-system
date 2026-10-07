"""
Unit tests for STATCOM sizing and reactive power compensation (P2A).

Tests validate cable reactive power calculation (Rule 7: Q always positive),
Ferranti voltage rise, STATCOM sizing margins, and compensation adequacy.

Test Strategy
-------------
- Cable Q: ≈ 130 MVAR per 220 kV, 45 km circuit; ≈ 260 MVAR for both export cables
- Ferranti rise: visible without compensation (> 1.0 pu at no-load)
- STATCOM sizing: ≥ 80 MVAR with margins
- Compensation: voltage compliant with STATCOM + reactors enabled
- Reactor N-1: one of 3 × 80 MVAR reactors out → STATCOM still inside ±120 MVAR
- Without compensation: voltage violation (validates necessity)
"""

import dataclasses

import pytest

from app.services.p2 import network_model
from app.services.p2.network_model import STATCOM_RATING_MVAR
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
        """One export circuit: Q = ω × C × V² × L = 314.16 × 190e-9 × (220e3)² × 45 ≈ 130 MVAR."""
        q = calculate_cable_reactive_power(num_cables=1)
        assert q == pytest.approx(130.0, abs=0.5), f"Cable Q = {q:.1f} MVAR"

    def test_cable_q_two_export_cables(self):
        """Default = both export circuits: 2 × 130 ≈ 260 MVAR."""
        assert calculate_cable_reactive_power() == pytest.approx(260.0, abs=1.0)

    def test_statcom_sizing_formula(self):
        """N-1 design case: (260 − 2 × 80) × 1.15 = 115 → rounded up to 120 MVAR."""
        assert size_statcom() == pytest.approx(120.0)

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
        """Rating with margins should exceed net Q after the in-service reactors."""
        cable_q = calculate_cable_reactive_power()
        net_q = cable_q - 2 * 80.0  # N-1: 2 of 3 reactors in service
        rating = size_statcom(cable_q_mvar=cable_q)
        assert rating >= net_q, f"Rating ({rating}) < net Q ({net_q})"

    def test_statcom_rating_rounded(self):
        """STATCOM rating must be rounded to nearest 10 MVAR."""
        rating = size_statcom()
        assert rating % 10 == 0

    def test_statcom_fewer_reactors_larger(self):
        """More reactors out of service → larger STATCOM needed."""
        assert (
            size_statcom(reactors_out=0)
            < size_statcom(reactors_out=1)
            < size_statcom(reactors_out=2)
        )

    def test_two_reactor_design_not_n1_secure(self):
        """Old 2 × 80 design: one out → (260 − 80) × 1.15 = 207 → 210 MVAR > ±120 MVAR."""
        assert size_statcom(num_reactors=2) == pytest.approx(210.0)
        assert size_statcom(num_reactors=2) > STATCOM_RATING_MVAR


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
        """Result must include total reactor Q (3 × 80 = 240 MVAR)."""
        result = validate_compensation()
        assert result.reactor_q_mvar == pytest.approx(240.0)

    def test_reactor_n1_secure(self):
        """One reactor out: voltage compliant and STATCOM not saturated (≈ −80 MVAR)."""
        result = validate_compensation()
        assert result.reactor_n1_secure
        assert -STATCOM_RATING_MVAR < result.reactor_n1_statcom_q_mvar < 0.0

    def test_reactor_n1_detects_insecure_design(self):
        """With only 2 reactors the N-1 check must fail (STATCOM saturates at −120 MVAR)."""
        two_reactors = dataclasses.replace(network_model.SB510, num_reactors=2)
        assert not validate_compensation(spec=two_reactors).reactor_n1_secure

    def test_ferranti_vs_uncompensated_rise(self):
        """Ferranti along 45 km is < 1 %; the 8 % rise comes from charging current via X."""
        result = validate_compensation()
        assert 0.005 < result.ferranti_rise_pu < 0.01
        assert result.uncompensated_rise_pu > 5 * result.ferranti_rise_pu

    def test_pse_reactive_range_at_poc(self):
        """PSE Art. 21(3)(c): −0.35 … +0.40 P_max at the POC, reached with reactor switching."""
        result = validate_compensation()
        assert result.pse_q_max_mvar == pytest.approx(204.0)
        assert result.pse_q_min_mvar == pytest.approx(-178.5)
        assert result.poc_q_max_mvar >= result.pse_q_max_mvar
        assert result.poc_q_min_mvar <= result.pse_q_min_mvar
        assert result.pse_q_range_met

    def test_statcom_range(self):
        """STATCOM Q range must be ±120 MVAR."""
        result = validate_compensation()
        assert result.statcom_q_range_min_mvar == pytest.approx(-120.0)
        assert result.statcom_q_range_max_mvar == pytest.approx(120.0)
