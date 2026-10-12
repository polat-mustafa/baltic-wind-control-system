"""
Fault ride-through screening (services/p2/frt_simulation.py).

Checks the quasi-static phasor model against the physics it encodes and the
PSE type-D requirements (FRT profile, K-factor reactive current, 5 s
recovery), plus Rule 1 (P ≤ P_rated) through the whole event.
"""

import pytest

from app.core.exceptions import ValidationError
from app.schemas.grid import FRTTimePoint, FRTType
from app.services.p2.frt_simulation import (
    I_MAX_PU,
    PRE_FAULT_S,
    iq_target,
    pse_frt_profile,
    run_frt_simulation,
)
from app.services.p2.network_model import TOTAL_CAPACITY_MW


def _during(result):
    t_clear = PRE_FAULT_S + result.fault_duration_s
    return [p for p in result.time_series if PRE_FAULT_S <= p.time_s < t_clear]


class TestPSEProfile:
    def test_zero_volt_for_150_ms_then_ramp_to_085_at_25_s(self):
        assert pse_frt_profile(0.0) == 0.0
        assert pse_frt_profile(0.15) == 0.0
        assert pse_frt_profile(2.5) == pytest.approx(0.85)
        assert pse_frt_profile(1.325) == pytest.approx(0.425)
        assert pse_frt_profile(10.0) == pytest.approx(0.85)

    def test_k_factor_characteristic(self):
        assert iq_target(0.05, 2.0) == 0.0  # inside the ±0.1 pu dead band
        assert iq_target(0.3, 2.0) == pytest.approx(0.6)
        assert iq_target(0.9, 2.0) == I_MAX_PU  # capped at rated current
        assert iq_target(-0.2, 2.0) == pytest.approx(-0.4)  # swell → inductive


class TestLVRT:
    def test_bolted_poc_fault_150_ms_must_be_ridden_through(self):
        r = run_frt_simulation(fault_bus="PSE_400kV", fault_impedance_pu=0.0)
        assert r.retained_voltage_pu < 0.01
        assert r.stayed_connected

    def test_bolted_poc_fault_300_ms_falls_below_profile(self):
        r = run_frt_simulation(fault_impedance_pu=0.0, fault_duration_s=0.3)
        assert not r.stayed_connected

    def test_retained_voltage_rises_with_fault_impedance(self):
        v = [
            run_frt_simulation(fault_impedance_pu=z).retained_voltage_pu for z in (0.0, 0.01, 0.05)
        ]
        assert v[0] < v[1] < v[2]

    def test_weaker_grid_gives_deeper_dip(self):
        strong = run_frt_simulation(fault_impedance_pu=0.01)
        weak = run_frt_simulation(fault_impedance_pu=0.01, grid_ssc_mva=2_000.0)
        assert weak.retained_voltage_pu < strong.retained_voltage_pu

    def test_reactive_current_follows_k_and_current_limit(self):
        r = run_frt_simulation(fault_impedance_pu=0.02)
        assert r.reactive_current_compliant
        assert r.reactive_current_gain == pytest.approx(2.0, rel=0.05)
        deep = run_frt_simulation(fault_impedance_pu=0.0)
        assert max(p.reactive_current_pu for p in _during(deep)) <= I_MAX_PU + 1e-9
        assert deep.reactive_current_compliant  # capped requirement

    def test_higher_k_injects_more_and_supports_voltage(self):
        k2 = run_frt_simulation(fault_impedance_pu=0.02)
        k4 = run_frt_simulation(fault_impedance_pu=0.02, k_factor=4.0)
        assert _during(k4)[-1].reactive_current_pu > _during(k2)[-1].reactive_current_pu
        assert k4.terminal_voltage_pu > k2.terminal_voltage_pu
        assert k2.retained_voltage_pu >= k2.passive_voltage_pu

    def test_active_power_never_exceeds_rating(self):
        for kw in ({}, {"fault_impedance_pu": 0.0}, {"fault_bus": "OSS_66kV"}):
            r = run_frt_simulation(**kw)
            assert max(p.active_power_mw for p in r.time_series) <= TOTAL_CAPACITY_MW + 1e-6
            assert min(p.active_power_mw for p in r.time_series) >= 0.0

    def test_active_power_drops_during_fault_and_recovers(self):
        r = run_frt_simulation(fault_impedance_pu=0.0)
        assert max(p.active_power_mw for p in _during(r)) < 0.5 * TOTAL_CAPACITY_MW
        assert r.recovery_compliant
        assert r.recovery_time_s < r.recovery_limit_s
        slow = run_frt_simulation(fault_impedance_pu=0.0, p_ramp_pu_s=0.2)
        assert slow.recovery_time_s > r.recovery_time_s

    def test_statcom_injects_capacitive_q(self):
        r = run_frt_simulation()
        assert r.statcom_peak_q_mvar > 0

    def test_envelope_is_returned_in_simulation_time(self):
        r = run_frt_simulation()
        assert r.envelope[0].time_s == pytest.approx(PRE_FAULT_S)
        assert r.envelope[-1].voltage_pu == pytest.approx(0.85)

    def test_unknown_bus_rejected(self):
        with pytest.raises(ValidationError):
            run_frt_simulation(fault_bus="WTG_99")


class TestHVRT:
    def test_swell_is_absorbed(self):
        r = run_frt_simulation(frt_type=FRTType.HVRT, fault_duration_s=0.1, swell_pu=1.2)
        assert r.retained_voltage_pu > 1.1
        assert _during(r)[-1].reactive_current_pu < 0  # inductive
        assert r.statcom_peak_q_mvar < 0
        assert r.stayed_connected
        assert r.envelope == []


def _points(values: list[tuple[float, float, float, float]]) -> list[FRTTimePoint]:
    return [
        FRTTimePoint(
            time_s=t,
            voltage_pu=v,
            active_power_mw=p,
            reactive_power_mvar=0.0,
            reactive_current_pu=iq,
        )
        for t, v, p, iq in values
    ]


class TestShuntsAndUnbalancedFaults:
    """Engineering audit B-3: cable charging and reactors in the network, symmetrical
    components for phase-phase and phase-earth faults."""

    def test_phase_phase_fault_equalises_v1_and_v2_at_the_fault(self):
        """Bolted b–c fault: positive and negative networks in parallel → V1 = V2 at the
        faulted bus (here the POC), both ≈ half the pre-fault voltage."""
        r = run_frt_simulation(FRTType.LVRT, fault_impedance_pu=0.0, fault_kind="2ph")
        during = [p for p in r.time_series if 0.2 <= p.time_s < 0.35]
        assert all(abs(p.voltage_pu - p.negative_sequence_pu) < 2e-3 for p in during)
        assert all(0.35 < p.voltage_pu < 0.65 for p in during)
        assert r.stayed_connected

    def test_earth_fault_at_the_poc_takes_one_phase_to_zero(self):
        """a–earth fault at 400 kV: the faulted phase collapses, the positive-sequence voltage
        (what the PSE profile is applied to) keeps ≈ 2/3."""
        r = run_frt_simulation(FRTType.LVRT, fault_impedance_pu=0.0, fault_kind="1ph")
        assert r.min_phase_voltage_pu < 0.05
        assert 0.55 < r.retained_voltage_pu < 0.8
        assert r.max_negative_sequence_pu > 0.2

    def test_array_earth_fault_hardly_reaches_the_poc(self):
        """66 kV is resistance earthed behind the OSS units' delta: an earth fault there
        leaves the 400 kV voltages almost untouched."""
        r = run_frt_simulation(
            FRTType.LVRT, fault_bus="OSS_66kV", fault_impedance_pu=0.0, fault_kind="1ph"
        )
        assert r.retained_voltage_pu > 0.97 and r.min_phase_voltage_pu > 0.97
        assert r.max_negative_sequence_pu < 0.02

    def test_post_clearance_overvoltage_is_reported(self):
        """At clearance the cable charging returns while the converters' capacitive Iq still
        decays (τ 26 ms): the voltage overshoots — the reason grid codes limit how slowly
        reactive current may be withdrawn."""
        r = run_frt_simulation(FRTType.LVRT, fault_impedance_pu=0.0)
        assert r.post_clearance_peak_pu > 1.05

    def test_negative_sequence_injection_lowers_v2(self):
        base = run_frt_simulation(FRTType.LVRT, fault_impedance_pu=0.02, fault_kind="2ph")
        k2 = run_frt_simulation(
            FRTType.LVRT, fault_impedance_pu=0.02, fault_kind="2ph", k2_factor=2.0
        )
        assert k2.max_negative_sequence_pu < base.max_negative_sequence_pu

    def test_bad_fault_kind_rejected(self):
        with pytest.raises(ValidationError):
            run_frt_simulation(FRTType.LVRT, fault_kind="3ph-g")
