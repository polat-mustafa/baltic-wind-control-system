"""
Unit tests for fault ride-through simulation (P2B — frt_simulation.py).

Tests validate LVRT/HVRT compliance against PSE IRiESP and NC RfG Type D:
stay connected, reactive current injection (Kqv ≥ 2.0), and active power
recovery (≥90% within 1.0 s).

Test Strategy
-------------
- LVRT: WTGs stay connected during 150 ms fault at OSS 66 kV
- Reactive current: ΔIq ≥ 2% per 1% ΔV (Kqv ≥ 2.0)
- Power recovery: ≥90% active power within 1.0 s after clearance
- HVRT: stable at 1.25 pu for 100 ms
- STATCOM: provides peak reactive power during fault
"""

from app.schemas.grid import FRTTimePoint, FRTType
from app.services.p2.frt_simulation import (
    check_active_power_recovery,
    check_reactive_current_compliance,
    run_frt_simulation,
)

# ── LVRT Tests ───────────────────────────────────────────────────


class TestLVRT:
    """Tests for low-voltage ride-through simulation."""

    def test_lvrt_stays_connected(self):
        """Wind farm must stay connected during LVRT event."""
        result = run_frt_simulation(
            frt_type=FRTType.LVRT,
            fault_bus="OSS_66kV",
            fault_impedance_pu=0.05,
            fault_duration_s=0.150,
        )
        assert result.stayed_connected, "WTGs disconnected during LVRT"

    def test_lvrt_reactive_current_compliant(self):
        """Reactive current injection must meet Kqv ≥ 2.0 per NC RfG."""
        result = run_frt_simulation(
            frt_type=FRTType.LVRT,
            fault_bus="OSS_66kV",
            fault_impedance_pu=0.05,
            fault_duration_s=0.150,
        )
        assert result.reactive_current_compliant, (
            f"Kqv = {result.reactive_current_gain:.2f} < 2.0 — NC RfG violation"
        )

    def test_lvrt_active_power_recovery(self):
        """Active power must recover to ≥90% within 1.0 s after clearance."""
        result = run_frt_simulation(
            frt_type=FRTType.LVRT,
            fault_bus="OSS_66kV",
            fault_impedance_pu=0.05,
            fault_duration_s=0.150,
        )
        assert result.recovery_compliant, (
            f"Recovery time = {result.recovery_time_s:.3f}s > 1.0s — NC RfG violation"
        )

    def test_lvrt_statcom_responds(self):
        """STATCOM must provide reactive power during LVRT."""
        result = run_frt_simulation(
            frt_type=FRTType.LVRT,
            fault_bus="OSS_66kV",
        )
        assert result.statcom_peak_q_mvar > 0, "STATCOM did not respond during LVRT"

    def test_lvrt_has_time_series(self):
        """LVRT result must include time-series data."""
        result = run_frt_simulation(frt_type=FRTType.LVRT)
        assert len(result.time_series) > 0, "No time-series data in LVRT result"


# ── HVRT Tests ───────────────────────────────────────────────────


class TestHVRT:
    """Tests for high-voltage ride-through simulation."""

    def test_hvrt_stays_connected(self):
        """Wind farm must stay connected during HVRT (1.25 pu, 100 ms)."""
        result = run_frt_simulation(
            frt_type=FRTType.HVRT,
            fault_bus="OSS_66kV",
            fault_duration_s=0.100,
        )
        assert result.stayed_connected, "WTGs disconnected during HVRT at 1.25 pu"


# ── Compliance Check Unit Tests ──────────────────────────────────


class TestComplianceChecks:
    """Tests for standalone compliance check functions."""

    def test_reactive_current_compliance_good(self):
        """Kqv = 3.0 should pass (≥ 2.0)."""
        # Simulate: pre-fault V=1.0, Iq=0.0 → fault V=0.5, Iq=1.5
        # ΔV = 0.5, ΔIq = 1.5 → Kqv = 3.0
        time_series = [
            FRTTimePoint(
                time_s=0.4,
                voltage_pu=1.0,
                active_power_mw=510,
                reactive_power_mvar=0,
                reactive_current_pu=0.0,
            ),
            FRTTimePoint(
                time_s=0.5,
                voltage_pu=1.0,
                active_power_mw=510,
                reactive_power_mvar=0,
                reactive_current_pu=0.0,
            ),
            FRTTimePoint(
                time_s=0.55,
                voltage_pu=0.5,
                active_power_mw=200,
                reactive_power_mvar=100,
                reactive_current_pu=1.5,
            ),
            FRTTimePoint(
                time_s=0.6,
                voltage_pu=0.5,
                active_power_mw=200,
                reactive_power_mvar=100,
                reactive_current_pu=1.5,
            ),
        ]
        compliant, kqv = check_reactive_current_compliance(
            time_series,
            t_fault=0.5,
            t_clear=0.65,
        )
        assert compliant
        assert kqv >= 2.0

    def test_reactive_current_compliance_fail(self):
        """Kqv = 1.0 should fail (< 2.0)."""
        time_series = [
            FRTTimePoint(
                time_s=0.4,
                voltage_pu=1.0,
                active_power_mw=510,
                reactive_power_mvar=0,
                reactive_current_pu=0.0,
            ),
            FRTTimePoint(
                time_s=0.5,
                voltage_pu=1.0,
                active_power_mw=510,
                reactive_power_mvar=0,
                reactive_current_pu=0.0,
            ),
            FRTTimePoint(
                time_s=0.55,
                voltage_pu=0.5,
                active_power_mw=200,
                reactive_power_mvar=50,
                reactive_current_pu=0.5,
            ),
        ]
        compliant, kqv = check_reactive_current_compliance(
            time_series,
            t_fault=0.5,
            t_clear=0.65,
        )
        assert not compliant
        assert kqv < 2.0

    def test_power_recovery_good(self):
        """Recovery to 95% within 0.5 s should pass."""
        time_series = [
            FRTTimePoint(
                time_s=0.65,
                voltage_pu=0.9,
                active_power_mw=100,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
            FRTTimePoint(
                time_s=0.80,
                voltage_pu=0.95,
                active_power_mw=400,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
            FRTTimePoint(
                time_s=1.0,
                voltage_pu=1.0,
                active_power_mw=480,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
        ]
        compliant, recovery_time = check_active_power_recovery(
            time_series,
            t_clear=0.65,
            pre_fault_p_mw=510.0,
        )
        assert compliant
        assert recovery_time < 1.0

    def test_power_recovery_fail(self):
        """Recovery to only 50% should fail."""
        time_series = [
            FRTTimePoint(
                time_s=0.65,
                voltage_pu=0.9,
                active_power_mw=100,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
            FRTTimePoint(
                time_s=1.65,
                voltage_pu=0.95,
                active_power_mw=250,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
            FRTTimePoint(
                time_s=2.65,
                voltage_pu=1.0,
                active_power_mw=250,
                reactive_power_mvar=0,
                reactive_current_pu=0,
            ),
        ]
        compliant, _ = check_active_power_recovery(
            time_series,
            t_clear=0.65,
            pre_fault_p_mw=510.0,
        )
        assert not compliant
