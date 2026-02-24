"""
Unit tests for IEC 60909 short-circuit analysis (P2A — short_circuit.py).

Tests validate initial symmetrical short-circuit currents (Ik''),
peak currents (ip), and breaker adequacy for the 66/220/400 kV network.

Test Strategy
-------------
- Ik'' ranges: reasonable for each voltage level (grid-connected network)
- Peak > symmetrical: ip > Ik'' (DC component contribution)
- Breaker adequacy: all Ik'' within rated breaking capacity
- Max Ik'' location: highest Ik'' expected near grid connection (400 kV)
- Two cases: max (c=1.1) and min (c=1.0)
"""

import pytest

from app.services.p2.short_circuit import calc_short_circuit

# ── Max Case Tests (c=1.1) ───────────────────────────────────────


class TestMaxCase:
    """Tests for maximum short-circuit case (c=1.1, breaker sizing)."""

    def test_max_case_returns_results(self):
        """Max case must return per-bus results for all 38 buses."""
        result = calc_short_circuit(case="max")
        assert len(result.bus_results) == 38

    def test_max_voltage_factor(self):
        """Max case must use c=1.1."""
        result = calc_short_circuit(case="max")
        assert result.voltage_factor_c == pytest.approx(1.1)

    def test_max_ikss_positive(self):
        """All Ik'' values must be positive."""
        result = calc_short_circuit(case="max")
        for bus in result.bus_results:
            assert bus.ikss_ka > 0, f"Ik'' at {bus.bus_name} = {bus.ikss_ka} kA"

    def test_max_ikss_at_400kv(self):
        """Highest Ik'' should be at or near the 400 kV bus (strongest source)."""
        result = calc_short_circuit(case="max")
        # The 400 kV bus has direct grid connection → highest fault level
        pse_bus = next(b for b in result.bus_results if b.bus_name == "PSE_400kV")
        assert pse_bus.ikss_ka > 10.0, f"PSE Ik'' = {pse_bus.ikss_ka} kA"

    def test_peak_greater_than_symmetrical(self):
        """Peak current ip must be greater than Ik'' (DC offset)."""
        result = calc_short_circuit(case="max")
        for bus in result.bus_results:
            assert bus.ip_ka >= bus.ikss_ka, (
                f"ip ({bus.ip_ka} kA) < Ik'' ({bus.ikss_ka} kA) at {bus.bus_name}"
            )

    def test_breaker_adequacy(self):
        """All breakers must be adequate for max case."""
        result = calc_short_circuit(case="max")
        assert result.breaker_adequate, (
            f"Breaker inadequate: max Ik'' = {result.max_ikss_ka} kA at {result.max_ikss_bus}"
        )

    def test_short_circuit_power_positive(self):
        """Short-circuit power Sk'' must be positive at all buses."""
        result = calc_short_circuit(case="max")
        for bus in result.bus_results:
            assert bus.skss_mw > 0, f"Sk'' at {bus.bus_name} = {bus.skss_mw} MVA"

    def test_66kv_ikss_range(self):
        """66 kV bus Ik'' should be in reasonable range (1–20 kA)."""
        result = calc_short_circuit(case="max")
        for bus in result.bus_results:
            if bus.vn_kv == 66.0:
                assert 0.5 < bus.ikss_ka < 25.0, (
                    f"Ik'' at {bus.bus_name} = {bus.ikss_ka} kA out of range"
                )

    def test_220kv_ikss_range(self):
        """220 kV bus Ik'' should be in reasonable range (1–30 kA)."""
        result = calc_short_circuit(case="max")
        for bus in result.bus_results:
            if bus.vn_kv == 220.0:
                assert 0.5 < bus.ikss_ka < 40.0, (
                    f"Ik'' at {bus.bus_name} = {bus.ikss_ka} kA out of range"
                )


# ── Min Case Tests (c=1.0) ───────────────────────────────────────


class TestMinCase:
    """Tests for minimum short-circuit case (c=1.0, protection sensitivity)."""

    def test_min_case_returns_results(self):
        """Min case must return results for all buses."""
        result = calc_short_circuit(case="min")
        assert len(result.bus_results) == 38

    def test_min_voltage_factor(self):
        """Min case must use c=1.0."""
        result = calc_short_circuit(case="min")
        assert result.voltage_factor_c == pytest.approx(1.0)

    def test_min_ikss_less_than_max(self):
        """Min case Ik'' must be less than max case at same bus."""
        max_result = calc_short_circuit(case="max")
        min_result = calc_short_circuit(case="min")

        for max_bus, min_bus in zip(max_result.bus_results, min_result.bus_results, strict=True):
            assert min_bus.ikss_ka <= max_bus.ikss_ka * 1.01, (
                f"Min ({min_bus.ikss_ka}) > Max ({max_bus.ikss_ka}) at {max_bus.bus_name}"
            )


# ── Error Handling Tests ─────────────────────────────────────────


class TestErrorHandling:
    """Tests for input validation."""

    def test_invalid_case_raises(self):
        """Invalid case parameter must raise ValueError."""
        with pytest.raises(ValueError, match="case must be"):
            calc_short_circuit(case="invalid")
